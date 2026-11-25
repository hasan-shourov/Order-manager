import type {
  CategoryDoc,
  ItemDoc,
  MemoDoc,
  SettingsDoc,
  UserDoc,
} from '../types';

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function serializeUser(user: UserDoc) {
  return {
    uid: user._id,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    approvedAt: iso(user.approvedAt),
    rejectedAt: iso(user.rejectedAt),
    revokedAt: iso(user.revokedAt),
  };
}

export function serializeCategory(category: CategoryDoc) {
  return {
    id: category._id,
    name: category.name,
    position: category.position,
    archivedAt: iso(category.archivedAt),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function serializeItem(item: ItemDoc) {
  return {
    id: item._id,
    categoryId: item.categoryId,
    name: item.name,
    defaultRate: item.defaultRate,
    position: item.position,
    archivedAt: iso(item.archivedAt),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeMemo(memo: MemoDoc) {
  return {
    id: memo._id,
    memoNumber: memo.memoNumber,
    createdAt: memo.createdAt.toISOString(),
    shopName: memo.shopName,
    address: memo.address,
    note: memo.note,
    printHeading: memo.printHeading,
    lines: memo.lines.map((line) => ({
      itemId: line.itemId,
      categoryId: line.categoryId,
      itemName: line.itemName,
      categoryName: line.categoryName,
      unitRate: line.unitRate,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })),
    subtotal: memo.subtotal,
    discountType: memo.discountType,
    discountValue: memo.discountValue,
    discountAmount: memo.discountAmount,
    totalPayable: memo.totalPayable,
    totalPieces: memo.totalPieces,
    deletedAt: iso(memo.deletedAt),
  };
}

export function serializeMemoSummary(memo: MemoDoc) {
  return {
    id: memo._id,
    memoNumber: memo.memoNumber,
    createdAt: memo.createdAt.toISOString(),
    shopName: memo.shopName,
    totalPayable: memo.totalPayable,
    totalPieces: memo.totalPieces,
  };
}

export function serializeSettings(settings: SettingsDoc | null) {
  return {
    printHeading: settings?.printHeading?.trim() || 'Sales Memo',
    updatedAt: settings ? settings.updatedAt.toISOString() : null,
  };
}
