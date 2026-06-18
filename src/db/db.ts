import Dexie, { type Table } from 'dexie';

export interface Category {
  id?: number;
  name: string;
  isActive: boolean;
}

export interface Brand {
  id?: number;
  name: string;
  isActive: boolean;
}

export interface Supplier {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface Product {
  id?: string; // using string uuid
  sku: string;
  name: string;
  categoryId?: number;
  brandId?: number;
  supplierId?: number;
  barcode?: string;
  pricingMode: 'AUTO_MARGIN' | 'MANUAL_PRICE' | 'LOCKED_PRICE';
  isActive: boolean;
  notes?: string;
}

export interface ProductUnit {
  id?: string;
  productId: string;
  unitName: string;
  conversionToBase: number;
  manualCost: number;
  activeSellingPrice: number;
  minSellingPrice?: number;
  maxSellingPrice?: number;
}

export interface MarginRule {
  id?: string;
  ruleType: 'STORE_DEFAULT' | 'CATEGORY' | 'BRAND' | 'SUPPLIER' | 'PRODUCT';
  referenceId?: string | number;
  marginPercent: number;
  priority: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
  isActive: boolean;
}

export interface PriceCalculation {
  id?: string;
  productId: string;
  productUnitId: string;
  inputCost: number;
  ppnMode: 'NO_PPN' | 'PPN_INCLUDED' | 'PPN_EXCLUDED';
  ppnRate: number;
  baseCost: number;
  ppnAmount: number;
  finalCost: number;
  marginPercent: number;
  calculatedPrice: number;
  roundedPrice: number;
  recommendedPrice: number;
  estimatedProfit: number;
  actualMargin: number;
  minPrice?: number;
  maxPrice?: number;
  status: 'DRAFT' | 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
  effectiveDate?: string;
  changeReason?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface PriceHistory {
  id?: string;
  productId: string;
  productUnitId: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  newPrice: number;
  oldMargin: number;
  newMargin: number;
  oldPpnMode: 'NO_PPN' | 'PPN_INCLUDED' | 'PPN_EXCLUDED' | 'UNKNOWN';
  newPpnMode: 'NO_PPN' | 'PPN_INCLUDED' | 'PPN_EXCLUDED';
  oldPpnAmount: number;
  newPpnAmount: number;
  pricingMode?: Product['pricingMode'];
  changeReason?: string;
  effectiveDate: string;
  changedBy?: string;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
}

export type ProductUnitCostSource = 'PRODUCT_FORM' | 'APPROVAL' | 'CSV_IMPORT' | 'SEED';

export interface ProductUnitCostHistory {
  id?: string;
  productId: string;
  productUnitId: string;
  supplierId?: number;
  inputCost: number;
  ppnMode: 'NO_PPN' | 'PPN_INCLUDED' | 'PPN_EXCLUDED';
  ppnRate: number;
  baseCost: number;
  ppnAmount: number;
  finalCost: number;
  previousFinalCost?: number;
  source: ProductUnitCostSource;
  effectiveDate: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: string;
  importBatchId?: string;
  createdAt: number;
}

export interface CsvImportBatch {
  id?: string;
  fileName: string;
  importType: 'PRODUCTS' | 'PRODUCT_COSTS' | 'FULL_PRODUCT_CATALOG';
  status: 'STAGED' | 'VALIDATED' | 'IMPORTED' | 'FAILED';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdAt: number;
  importedAt?: number;
  errorMessage?: string;
}

export interface CsvImportRow {
  id?: string;
  batchId: string;
  rowNumber: number;
  rawData: Record<string, string>;
  mappedData?: Record<string, string | number | boolean | undefined>;
  status: 'PENDING' | 'VALID' | 'INVALID' | 'IMPORTED';
  errorMessage?: string;
  createdAt: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface PosSale {
  id: string;
  transactionId: string;
  cashierId: string;
  outletId: string;
  createdAt: string;
  total: number;
  paid: number;
  change: number;
  payload: string;
  receivedAt: number;
}

export interface RealtimeSyncLog {
  id: string;
  direction: 'IN' | 'OUT';
  eventType: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  createdAt: number;
}

export type PosRoleName = 'Owner' | 'Admin' | 'Supervisor' | 'Kasir';

export interface AuthRole {
  id: string;
  name: PosRoleName;
  description: string;
  permissions: string[];
}

export interface AuthPermission {
  id: string;
  code: string;
  name: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role_id: string;
  role: PosRoleName;
  pin: string;
  phone?: string;
  email?: string;
  position_title?: string;
  profile_note?: string;
  is_active: boolean;
  created_at: string;
}

export class InventoryPricingDatabase extends Dexie {
  categories!: Table<Category, number>;
  brands!: Table<Brand, number>;
  suppliers!: Table<Supplier, number>;
  products!: Table<Product, string>;
  productUnits!: Table<ProductUnit, string>;
  marginRules!: Table<MarginRule, string>;
  priceCalculations!: Table<PriceCalculation, string>;
  priceHistories!: Table<PriceHistory, string>;
  productUnitCostHistories!: Table<ProductUnitCostHistory, string>;
  csvImportBatches!: Table<CsvImportBatch, string>;
  csvImportRows!: Table<CsvImportRow, string>;
  appSettings!: Table<AppSetting, string>;
  posSales!: Table<PosSale, string>;
  realtimeSyncLogs!: Table<RealtimeSyncLog, string>;
  authUsers!: Table<AuthUser, string>;
  authRoles!: Table<AuthRole, string>;
  authPermissions!: Table<AuthPermission, string>;

  constructor() {
    super('InventoryPricingDatabase');
    this.version(1).stores({
      categories: '++id, name, isActive',
      brands: '++id, name, isActive',
      suppliers: '++id, name, isActive',
      products: 'id, sku, name, categoryId, brandId, supplierId, pricingMode, isActive',
      productUnits: 'id, productId, unitName',
      marginRules: 'id, ruleType, referenceId, isActive',
      priceCalculations: 'id, productId, productUnitId, status, createdAt',
      priceHistories: 'id, productId, productUnitId, createdAt',
      appSettings: 'key'
    });
    this.version(2).stores({
      categories: '++id, name, isActive',
      brands: '++id, name, isActive',
      suppliers: '++id, name, isActive',
      products: 'id, sku, name, categoryId, brandId, supplierId, barcode, pricingMode, isActive',
      productUnits: 'id, productId, unitName',
      marginRules: 'id, ruleType, referenceId, isActive',
      priceCalculations: 'id, productId, productUnitId, status, effectiveDate, createdAt',
      priceHistories: 'id, productId, productUnitId, effectiveDate, createdAt',
      appSettings: 'key'
    });
    this.version(3).stores({
      categories: '++id, name, isActive',
      brands: '++id, name, isActive',
      suppliers: '++id, name, isActive',
      products: 'id, sku, name, categoryId, brandId, supplierId, barcode, pricingMode, isActive',
      productUnits: 'id, productId, unitName',
      marginRules: 'id, ruleType, referenceId, isActive',
      priceCalculations: 'id, productId, productUnitId, status, effectiveDate, createdAt',
      priceHistories: 'id, productId, productUnitId, effectiveDate, createdAt',
      productUnitCostHistories: 'id, productId, productUnitId, supplierId, source, effectiveDate, importBatchId, createdAt',
      csvImportBatches: 'id, importType, status, createdAt',
      csvImportRows: 'id, batchId, rowNumber, status, createdAt',
      appSettings: 'key'
    });
    this.version(4).stores({
      categories: '++id, name, isActive',
      brands: '++id, name, isActive',
      suppliers: '++id, name, isActive',
      products: 'id, sku, name, categoryId, brandId, supplierId, barcode, pricingMode, isActive',
      productUnits: 'id, productId, unitName',
      marginRules: 'id, ruleType, referenceId, isActive',
      priceCalculations: 'id, productId, productUnitId, status, effectiveDate, createdAt',
      priceHistories: 'id, productId, productUnitId, effectiveDate, createdAt',
      productUnitCostHistories: 'id, productId, productUnitId, supplierId, source, effectiveDate, importBatchId, createdAt',
      csvImportBatches: 'id, importType, status, createdAt',
      csvImportRows: 'id, batchId, rowNumber, status, createdAt',
      appSettings: 'key',
      posSales: 'id, transactionId, outletId, cashierId, createdAt, receivedAt',
      realtimeSyncLogs: 'id, direction, eventType, status, createdAt'
    });
    this.version(5).stores({
      categories: '++id, name, isActive',
      brands: '++id, name, isActive',
      suppliers: '++id, name, isActive',
      products: 'id, sku, name, categoryId, brandId, supplierId, barcode, pricingMode, isActive',
      productUnits: 'id, productId, unitName',
      marginRules: 'id, ruleType, referenceId, isActive',
      priceCalculations: 'id, productId, productUnitId, status, effectiveDate, createdAt',
      priceHistories: 'id, productId, productUnitId, effectiveDate, createdAt',
      productUnitCostHistories: 'id, productId, productUnitId, supplierId, source, effectiveDate, importBatchId, createdAt',
      csvImportBatches: 'id, importType, status, createdAt',
      csvImportRows: 'id, batchId, rowNumber, status, createdAt',
      appSettings: 'key',
      posSales: 'id, transactionId, outletId, cashierId, createdAt, receivedAt',
      realtimeSyncLogs: 'id, direction, eventType, status, createdAt',
      authUsers: 'id, role, role_id, pin, phone, email, is_active',
      authRoles: 'id, name',
      authPermissions: 'id, code',
    });
  }
}

export const db = new InventoryPricingDatabase();
