import type { CategoryDoc, ItemDoc, MemoDoc } from '../types';

export interface SummaryItemRow {
  itemId: string;
  itemName: string;
  piecesSold: number;
  grossSales: number;
}

export interface SummaryCategoryRow {
  categoryId: string;
  categoryName: string;
  piecesSold: number;
  grossSales: number;
  items: SummaryItemRow[];
}

export interface SummaryResult {
  memoCount: number;
  totalPieces: number;
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  categories: SummaryCategoryRow[];
}

interface SalesAccumulator {
  piecesSold: number;
  grossSales: number;
  snapshotItemName: string;
  snapshotCategoryId: string;
  snapshotCategoryName: string;
  latestMemoTime: number;
}

interface WorkingRow extends SummaryItemRow {
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  itemOrder: number;
}

export function buildSummary(
  memos: MemoDoc[],
  categories: CategoryDoc[],
  items: ItemDoc[]
): SummaryResult {
  const categoryMap = new Map(categories.map((category) => [category._id, category]));
  const itemMap = new Map(items.map((item) => [item._id, item]));
  const sales = new Map<string, SalesAccumulator>();

  for (const memo of memos) {
    const memoTime = memo.createdAt.getTime();
    for (const line of memo.lines) {
      const current = sales.get(line.itemId);
      if (!current) {
        sales.set(line.itemId, {
          piecesSold: line.quantity,
          grossSales: line.lineTotal,
          snapshotItemName: line.itemName,
          snapshotCategoryId: line.categoryId,
          snapshotCategoryName: line.categoryName,
          latestMemoTime: memoTime,
        });
        continue;
      }
      current.piecesSold += line.quantity;
      current.grossSales += line.lineTotal;
      if (memoTime >= current.latestMemoTime) {
        current.latestMemoTime = memoTime;
        current.snapshotItemName = line.itemName;
        current.snapshotCategoryId = line.categoryId;
        current.snapshotCategoryName = line.categoryName;
      }
    }
  }

  const rows: WorkingRow[] = [];

  for (const item of items) {
    const salesEntry = sales.get(item._id);
    const category = categoryMap.get(item.categoryId);
    const categoryIsActive = Boolean(category && category.archivedAt === null);
    const itemIsActive = item.archivedAt === null;
    const hasSales = Boolean(salesEntry && salesEntry.piecesSold > 0);

    if (!itemIsActive && !hasSales) continue;
    if (itemIsActive && !categoryIsActive && !hasSales) continue;

    rows.push({
      itemId: item._id,
      itemName: item.name,
      piecesSold: salesEntry?.piecesSold ?? 0,
      grossSales: salesEntry?.grossSales ?? 0,
      categoryId: category?._id ?? salesEntry?.snapshotCategoryId ?? item.categoryId,
      categoryName:
        category?.name ??
        salesEntry?.snapshotCategoryName ??
        'Uncategorized',
      categoryOrder: category ? category.position : Number.MAX_SAFE_INTEGER,
      itemOrder: item.position,
    });
  }

  for (const [itemId, entry] of sales) {
    if (itemMap.has(itemId)) continue;
    const category = categoryMap.get(entry.snapshotCategoryId);
    rows.push({
      itemId,
      itemName: entry.snapshotItemName,
      piecesSold: entry.piecesSold,
      grossSales: entry.grossSales,
      categoryId: category?._id ?? entry.snapshotCategoryId,
      categoryName: category?.name ?? entry.snapshotCategoryName ?? 'Uncategorized',
      categoryOrder: category ? category.position : Number.MAX_SAFE_INTEGER,
      itemOrder: Number.MAX_SAFE_INTEGER,
    });
  }

  rows.sort((a, b) => {
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
    if (a.itemOrder !== b.itemOrder) return a.itemOrder - b.itemOrder;
    return a.itemName.localeCompare(b.itemName);
  });

  const grouped = new Map<string, SummaryCategoryRow>();
  for (const row of rows) {
    let categoryRow = grouped.get(row.categoryId);
    if (!categoryRow) {
      categoryRow = {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        piecesSold: 0,
        grossSales: 0,
        items: [],
      };
      grouped.set(row.categoryId, categoryRow);
    }
    categoryRow.items.push({
      itemId: row.itemId,
      itemName: row.itemName,
      piecesSold: row.piecesSold,
      grossSales: row.grossSales,
    });
    categoryRow.piecesSold += row.piecesSold;
    categoryRow.grossSales += row.grossSales;
  }

  let totalPieces = 0;
  let grossSales = 0;
  let totalDiscounts = 0;
  for (const memo of memos) {
    totalPieces += memo.totalPieces;
    grossSales += memo.subtotal;
    totalDiscounts += memo.discountAmount;
  }

  return {
    memoCount: memos.length,
    totalPieces,
    grossSales,
    totalDiscounts,
    netSales: grossSales - totalDiscounts,
    categories: [...grouped.values()],
  };
}
