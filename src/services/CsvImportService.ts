import { db, type CsvImportBatch, type Product, type ProductUnit } from '../db/db';
import { TaxCalculatorService, PpnMode, type PpnMode as PpnModeType } from './TaxCalculatorService';
import { ProductUnitCostHistoryService } from './ProductUnitCostHistoryService';

export interface CsvImportResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ProductCatalogCsvRow {
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  supplier?: string;
  unit_name: string;
  conversion_to_base?: string;
  manual_cost: string;
  active_selling_price?: string;
  min_selling_price?: string;
  max_selling_price?: string;
  barcode?: string;
  pricing_mode?: Product['pricingMode'];
  ppn_mode?: PpnModeType;
  ppn_rate?: string;
  effective_date?: string;
  notes?: string;
}

const PRODUCT_CATALOG_COLUMNS = [
  'sku',
  'name',
  'category',
  'brand',
  'supplier',
  'unit_name',
  'conversion_to_base',
  'manual_cost',
  'active_selling_price',
  'min_selling_price',
  'max_selling_price',
  'barcode',
  'pricing_mode',
  'ppn_mode',
  'ppn_rate',
  'effective_date',
  'notes',
];

export class CsvImportService {
  static getProductCatalogColumns(): string[] {
    return PRODUCT_CATALOG_COLUMNS;
  }

  static parse(text: string): Record<string, string>[] {
    const rows = CsvImportService.parseRows(text.trim());
    if (rows.length === 0) return [];

    const headers = rows[0].map(header => CsvImportService.normalizeHeader(header));
    return rows.slice(1)
      .filter(row => row.some(cell => cell.trim()))
      .map(row => {
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = row[index]?.trim() ?? '';
        });
        return record;
      });
  }

  static async importProductCatalog(fileName: string, text: string): Promise<CsvImportResult> {
    const records = CsvImportService.parse(text);
    const batchId = crypto.randomUUID();
    const createdAt = Date.now();
    let validRows = 0;
    let invalidRows = 0;

    const batch: CsvImportBatch = {
      id: batchId,
      fileName,
      importType: 'FULL_PRODUCT_CATALOG',
      status: 'STAGED',
      totalRows: records.length,
      validRows: 0,
      invalidRows: 0,
      createdAt,
    };

    await db.transaction('rw', [
      db.csvImportBatches,
      db.csvImportRows,
      db.categories,
      db.brands,
      db.suppliers,
      db.products,
      db.productUnits,
      db.productUnitCostHistories,
    ], async () => {
      await db.csvImportBatches.add(batch);

      for (const [index, rawRecord] of records.entries()) {
        const rowNumber = index + 2;
        try {
          const row = CsvImportService.validateProductCatalogRow(rawRecord);
          await CsvImportService.upsertProductCatalogRow(row, batchId);
          validRows += 1;

          await db.csvImportRows.add({
            id: crypto.randomUUID(),
            batchId,
            rowNumber,
            rawData: rawRecord,
            mappedData: { ...row },
            status: 'IMPORTED',
            createdAt,
          });
        } catch (error) {
          invalidRows += 1;
          await db.csvImportRows.add({
            id: crypto.randomUUID(),
            batchId,
            rowNumber,
            rawData: rawRecord,
            status: 'INVALID',
            errorMessage: error instanceof Error ? error.message : 'Data tidak valid',
            createdAt,
          });
        }
      }

      await db.csvImportBatches.update(batchId, {
        status: invalidRows > 0 ? 'FAILED' : 'IMPORTED',
        validRows,
        invalidRows,
        importedAt: Date.now(),
      });
    });

    return {
      batchId,
      totalRows: records.length,
      validRows,
      invalidRows,
    };
  }

  private static async upsertProductCatalogRow(row: ProductCatalogCsvRow, batchId: string): Promise<void> {
    const categoryId = row.category ? await CsvImportService.findOrCreateCategory(row.category) : undefined;
    const brandId = row.brand ? await CsvImportService.findOrCreateBrand(row.brand) : undefined;
    const supplierId = row.supplier ? await CsvImportService.findOrCreateSupplier(row.supplier) : undefined;
    const existingProduct = await db.products.where('sku').equals(row.sku).first();
    const productId = existingProduct?.id ?? crypto.randomUUID();
    const pricingMode = CsvImportService.parsePricingMode(row.pricing_mode);

    await db.products.put({
      id: productId,
      sku: row.sku,
      name: row.name,
      categoryId,
      brandId,
      supplierId,
      barcode: row.barcode || existingProduct?.barcode,
      pricingMode,
      isActive: true,
      notes: row.notes || existingProduct?.notes,
    });

    const inputCost = CsvImportService.parseMoney(row.manual_cost, 'manual_cost');
    const ppnMode = CsvImportService.parsePpnMode(row.ppn_mode);
    const ppnRate = CsvImportService.parseOptionalNumber(row.ppn_rate) ?? 0;
    const taxResult = TaxCalculatorService.calculate(inputCost, ppnMode, ppnRate);
    const existingUnits = await db.productUnits.where('productId').equals(productId).toArray();
    const existingUnit = existingUnits.find(unit => unit.unitName.toLowerCase() === row.unit_name.toLowerCase());
    const unitId = existingUnit?.id ?? crypto.randomUUID();

    const unitData: ProductUnit = {
      id: unitId,
      productId,
      unitName: row.unit_name,
      conversionToBase: CsvImportService.parseOptionalNumber(row.conversion_to_base) ?? existingUnit?.conversionToBase ?? 1,
      manualCost: taxResult.finalCost,
      activeSellingPrice: CsvImportService.parseOptionalNumber(row.active_selling_price) ?? existingUnit?.activeSellingPrice ?? taxResult.finalCost,
      minSellingPrice: CsvImportService.parseOptionalNumber(row.min_selling_price) ?? existingUnit?.minSellingPrice,
      maxSellingPrice: CsvImportService.parseOptionalNumber(row.max_selling_price) ?? existingUnit?.maxSellingPrice,
    };

    await db.productUnits.put(unitData);

    if (!existingUnit || existingUnit.manualCost !== unitData.manualCost) {
      await db.productUnitCostHistories.add(
        ProductUnitCostHistoryService.build({
          productId,
          productUnitId: unitId,
          supplierId,
          inputCost: taxResult.inputCost,
          ppnMode: taxResult.ppnMode,
          ppnRate: taxResult.ppnRate,
          baseCost: taxResult.baseCost,
          ppnAmount: taxResult.ppnAmount,
          finalCost: taxResult.finalCost,
          previousFinalCost: existingUnit?.manualCost,
          source: 'CSV_IMPORT',
          effectiveDate: row.effective_date || undefined,
          notes: row.notes || 'Import CSV',
          createdBy: 'CSV Import',
          importBatchId: batchId,
        }),
      );
    }
  }

  private static validateProductCatalogRow(raw: Record<string, string>): ProductCatalogCsvRow {
    const row = raw as unknown as ProductCatalogCsvRow;
    if (!row.sku?.trim()) throw new Error('sku wajib diisi');
    if (!row.name?.trim()) throw new Error('name wajib diisi');
    if (!row.unit_name?.trim()) throw new Error('unit_name wajib diisi');
    if (!row.manual_cost?.trim()) throw new Error('manual_cost wajib diisi');
    CsvImportService.parseMoney(row.manual_cost, 'manual_cost');

    return {
      ...row,
      sku: row.sku.trim(),
      name: row.name.trim(),
      category: row.category?.trim(),
      brand: row.brand?.trim(),
      supplier: row.supplier?.trim(),
      unit_name: row.unit_name.trim(),
      barcode: row.barcode?.trim(),
      notes: row.notes?.trim(),
    };
  }

  private static async findOrCreateCategory(name: string): Promise<number> {
    const existing = await db.categories.where('name').equalsIgnoreCase(name).first();
    if (existing?.id) return existing.id;
    return db.categories.add({ name, isActive: true });
  }

  private static async findOrCreateBrand(name: string): Promise<number> {
    const existing = await db.brands.where('name').equalsIgnoreCase(name).first();
    if (existing?.id) return existing.id;
    return db.brands.add({ name, isActive: true });
  }

  private static async findOrCreateSupplier(name: string): Promise<number> {
    const existing = await db.suppliers.where('name').equalsIgnoreCase(name).first();
    if (existing?.id) return existing.id;
    return db.suppliers.add({ name, isActive: true });
  }

  private static parseRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  private static normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private static parseMoney(value: string, fieldName: string): number {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${fieldName} harus angka positif`);
    }
    return parsed;
  }

  private static parseOptionalNumber(value?: string): number | undefined {
    if (!value?.trim()) return undefined;
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private static parsePricingMode(value?: string): Product['pricingMode'] {
    if (value === 'MANUAL_PRICE' || value === 'LOCKED_PRICE') return value;
    return 'AUTO_MARGIN';
  }

  private static parsePpnMode(value?: string): PpnModeType {
    if (value === PpnMode.PPN_INCLUDED || value === PpnMode.PPN_EXCLUDED) return value;
    return PpnMode.NO_PPN;
  }
}
