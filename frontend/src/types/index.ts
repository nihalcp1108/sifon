export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface Brand {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  areaCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Area {
  _id: string;
  name?: string;
  sectionId?: string | Section;
  section?: Section;
  areaNumber?: number;
  displayName: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AreaBalance {
  _id: string;
  productId: string;
  areaId: Area;
  availableQuantity: number;
  damagedQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  code?: string;
  name: string;
  brandId?: string | Brand;
  categoryId?: string | Category;
  brand?: Brand;
  category?: Category;
  details?: string;
  unit: string;
  isActive: boolean;
  totalAvailable?: number;
  totalDamaged?: number;
  areaBalances?: AreaBalance[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  totalAvailable: number;
  totalDamaged: number;
  balances: AreaBalance[];
}

export interface InventoryMovement {
  _id: string;
  productId: string | Product;
  areaId: Area;
  availableDelta: number;
  damagedDelta: number;
  movementType:
    | 'OPENING_STOCK'
    | 'PURCHASE'
    | 'PURCHASE_REVERSAL'
    | 'SALE'
    | 'SALE_REVERSAL'
    | 'RETURN_AVAILABLE'
    | 'RETURN_DAMAGED'
    | 'RETURN_REVERSAL_AVAILABLE'
    | 'RETURN_REVERSAL_DAMAGED';
  sourceDocumentType: 'OPENING' | 'PURCHASE' | 'SALE' | 'RETURN';
  sourceDocumentId: string;
  sourceDocumentLineId?: string;
  originalMovementId?: string;
  businessDate: string;
  createdBy: { _id: string; name: string; email: string };
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  _id?: string;
  productId: Product | string;
  receivingAreaId: Area | string;
  quantity: number;
}

export interface Purchase {
  _id: string;
  reference: string;
  purchaseDate: string;
  items: {
    _id: string;
    productId: Product;
    receivingAreaId: Area;
    quantity: number;
  }[];
  notes?: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: { _id: string; name: string; email: string };
  createdBy: { _id: string; name: string; email: string };
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  _id: string;
  productId: Product;
  sourceAreaId: Area;
  quantity: number;
  returnedQuantity: number;
}

export interface Sale {
  _id: string;
  reference: string;
  saleDate: string;
  items: SaleItem[];
  notes?: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: { _id: string; name: string; email: string };
  createdBy: { _id: string; name: string; email: string };
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRecord {
  _id: string;
  reference: string;
  returnDate: string;
  saleId: { _id: string; reference: string; saleDate: string; items?: SaleItem[] };
  saleLineId: string;
  productId: Product;
  receivingAreaId: Area;
  nonDamagedQuantity: number;
  damagedQuantity: number;
  reason: string;
  status: 'POSTED' | 'CANCELLED';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: { _id: string; name: string; email: string };
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface DamagedBalanceItem {
  _id: string;
  productId: Product;
  areaId: Area;
  damagedQuantity: number;
  availableQuantity: number;
}

export interface DashboardSummary {
  activeProductCount: number;
  activeAreaCount: number;
  totalAvailableQuantity: number;
  totalDamagedQuantity: number;
  todayPurchasedQuantity: number;
  todaySoldQuantity: number;
  recentPurchases: Purchase[];
  recentSales: Sale[];
  recentReturns: ReturnRecord[];
}

export interface MatrixStatementData {
  areas: Area[];
  rows: {
    product: Product;
    areaQuantities: Record<string, { available: number; damaged: number }>;
    totalAvailable: number;
    totalDamaged: number;
  }[];
}

export interface PeriodStatementRow {
  product: Product;
  area: { _id: string; areaNumber: number; displayName: string };
  openingAvailable: number;
  openingStockAdded: number;
  purchased: number;
  sold: number;
  returnedNonDamaged: number;
  reversals: {
    purchaseReversals: number;
    saleReversals: number;
    returnReversals: number;
    netAvailableReversals: number;
  };
  closingAvailable: number;
  openingDamaged: number;
  returnedDamaged: number;
  damagedReversals: number;
  closingDamaged: number;
}

export interface PeriodStatementData {
  period: {
    startDate: string;
    endDate: string;
  };
  rows: PeriodStatementRow[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

