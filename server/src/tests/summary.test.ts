import { describe, expect, it } from 'vitest';
import { buildSummary } from '../services/summary';
import type { CategoryDoc, ItemDoc, MemoDoc } from '../types';

function category(
  id: string,
  name: string,
  position: number,
  archived = false
): CategoryDoc {
  return {
    _id: id,
    ownerUid: 'owner',
    name,
    position,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    archivedAt: archived ? new Date('2026-02-01T00:00:00Z') : null,
  };
}

function item(
  id: string,
  categoryId: string,
  name: string,
  position: number,
  archived = false
): ItemDoc {
  return {
    _id: id,
    ownerUid: 'owner',
    categoryId,
    name,
    defaultRate: 1000,
    position,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    archivedAt: archived ? new Date('2026-02-01T00:00:00Z') : null,
  };
}

function memo(
  id: string,
  createdAt: string,
  lines: Array<{
    itemId: string;
    categoryId: string;
    itemName: string;
    categoryName: string;
    unitRate: number;
    quantity: number;
  }>,
  discountAmount = 0
): MemoDoc {
  const snapshotLines = lines.map((line) => ({
    ...line,
    lineTotal: line.unitRate * line.quantity,
  }));
  const subtotal = snapshotLines.reduce((sum, line) => sum + line.lineTotal, 0);
  return {
    _id: id,
    ownerUid: 'owner',
    memoNumber: id,
    sequence: 1,
    clientRequestId: `req-${id}`,
    shopName: 'Shop',
    address: '',
    note: '',
    printHeading: 'Sales Memo',
    lines: snapshotLines,
    subtotal,
    discountType: discountAmount ? 'percentage' : 'none',
    discountValue: discountAmount ? 10 : 0,
    discountAmount,
    totalPayable: subtotal - discountAmount,
    totalPieces: snapshotLines.reduce((sum, line) => sum + line.quantity, 0),
    createdAt: new Date(createdAt),
    deletedAt: null,
  };
}

const categories = [
  category('cat-juice', 'Juice', 1),
  category('cat-snack', 'Snack', 2),
  category('cat-old', 'Old', 3, true),
];

const items = [
  item('item-juice', 'cat-juice', 'Juice Bottle', 1),
  item('item-water', 'cat-juice', 'Water', 2),
  item('item-chips', 'cat-snack', 'Chips', 1),
  item('item-old', 'cat-old', 'Old Biscuit', 1, true),
  item('item-archived', 'cat-juice', 'Archived Empty', 3, true),
];

const memos = [
  memo(
    'm2',
    '2026-11-22T10:00:00Z',
    [
      {
        itemId: 'item-old',
        categoryId: 'cat-old',
        itemName: 'Old Biscuit',
        categoryName: 'Old',
        unitRate: 500,
        quantity: 1,
      },
    ]
  ),
  memo(
    'm1',
    '2026-11-20T10:00:00Z',
    [
      {
        itemId: 'item-juice',
        categoryId: 'cat-juice',
        itemName: 'Juice (Btl) 100',
        categoryName: 'Juice',
        unitRate: 1150,
        quantity: 3,
      },
      {
        itemId: 'item-chips',
        categoryId: 'cat-snack',
        itemName: 'Chips',
        categoryName: 'Snack',
        unitRate: 800,
        quantity: 2,
      },
    ],
    505
  ),
];

describe('buildSummary', () => {
  it('includes active items with zero sales and excludes archived items without sales', () => {
    const summary = buildSummary(memos, categories, items);
    const juice = summary.categories.find((row) => row.categoryId === 'cat-juice');
    expect(juice).toBeDefined();
    const rows = juice!.items;
    expect(rows.map((row) => row.itemId)).toEqual(['item-juice', 'item-water']);
    expect(rows.find((row) => row.itemId === 'item-water')).toEqual({
      itemId: 'item-water',
      itemName: 'Water',
      piecesSold: 0,
      grossSales: 0,
    });
    expect(rows.some((row) => row.itemId === 'item-archived')).toBe(false);
  });

  it('keeps archived items when they have sales and groups by stable item id', () => {
    const summary = buildSummary(memos, categories, items);
    const old = summary.categories.find((row) => row.categoryId === 'cat-old');
    expect(old?.items).toEqual([
      {
        itemId: 'item-old',
        itemName: 'Old Biscuit',
        piecesSold: 1,
        grossSales: 500,
      },
    ]);

    const juice = summary.categories.find((row) => row.categoryId === 'cat-juice');
    const juiceRow = juice?.items.find((row) => row.itemId === 'item-juice');
    expect(juiceRow).toEqual({
      itemId: 'item-juice',
      itemName: 'Juice Bottle',
      piecesSold: 3,
      grossSales: 3450,
    });
  });

  it('deducts each memo discount once and totals the report', () => {
    const summary = buildSummary(memos, categories, items);
    expect(summary.memoCount).toBe(2);
    expect(summary.totalPieces).toBe(6);
    expect(summary.grossSales).toBe(5550);
    expect(summary.totalDiscounts).toBe(505);
    expect(summary.netSales).toBe(5045);
  });

  it('falls back to snapshot names when an item is missing from the catalog', () => {
    const summary = buildSummary(
      [
        memo('m3', '2026-11-23T10:00:00Z', [
          {
            itemId: 'missing-item',
            categoryId: 'missing-cat',
            itemName: 'Snapshot Name',
            categoryName: 'Snapshot Category',
            unitRate: 200,
            quantity: 2,
          },
        ]),
      ],
      categories,
      items
    );
    const categoryRow = summary.categories.find(
      (row) => row.categoryId === 'missing-cat'
    );
    expect(categoryRow?.categoryName).toBe('Snapshot Category');
    expect(categoryRow?.items[0]).toEqual({
      itemId: 'missing-item',
      itemName: 'Snapshot Name',
      piecesSold: 2,
      grossSales: 400,
    });
  });

  it('returns zero totals with active catalog items still listed', () => {
    const summary = buildSummary([], categories, items);
    expect(summary.memoCount).toBe(0);
    expect(summary.totalPieces).toBe(0);
    expect(summary.grossSales).toBe(0);
    expect(summary.totalDiscounts).toBe(0);
    expect(summary.netSales).toBe(0);
    expect(summary.categories.flatMap((row) => row.items)).toHaveLength(3);
  });
});
