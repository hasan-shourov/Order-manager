export type UserStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type UserRole = 'admin' | 'user';
export type DiscountType = 'none' | 'fixed' | 'percentage';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItem {
  id: string;
  categoryId: string;
  name: string;
  defaultRate: number;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Catalog {
  categories: Category[];
  items: CatalogItem[];
}

export interface Settings {
  printHeading: string;
  updatedAt: string | null;
}

export interface MemoLine {
  itemId: string;
  categoryId: string;
  itemName: string;
  categoryName: string;
  unitRate: number;
  quantity: number;
  lineTotal: number;
}

export interface Memo {
  id: string;
  memoNumber: string;
  createdAt: string;
  shopName: string;
  address: string;
  note: string;
  printHeading: string;
  lines: MemoLine[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  totalPayable: number;
  totalPieces: number;
  deletedAt: string | null;
}

export interface MemoSummary {
  id: string;
  memoNumber: string;
  createdAt: string;
  shopName: string;
  totalPayable: number;
  totalPieces: number;
}

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
  range: { from: string; to: string } | null;
}
