export type UserStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type UserRole = 'admin' | 'user';
export type DiscountType = 'none' | 'fixed' | 'percentage';

export interface UserDoc {
  _id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  revokedAt?: Date | null;
  reviewedBy?: string | null;
}

export interface CategoryDoc {
  _id: string;
  ownerUid: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ItemDoc {
  _id: string;
  ownerUid: string;
  categoryId: string;
  name: string;
  defaultRate: number;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface MemoLineDoc {
  itemId: string;
  categoryId: string;
  itemName: string;
  categoryName: string;
  unitRate: number;
  quantity: number;
  lineTotal: number;
}

export interface MemoDoc {
  _id: string;
  ownerUid: string;
  memoNumber: string;
  sequence: number;
  clientRequestId: string;
  shopName: string;
  address: string;
  note: string;
  printHeading: string;
  lines: MemoLineDoc[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  totalPayable: number;
  totalPieces: number;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface SettingsDoc {
  _id: string;
  printHeading: string;
  updatedAt: Date;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface AuthInfo {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authInfo?: AuthInfo;
      currentUser?: UserDoc;
    }
  }
}

export {};
