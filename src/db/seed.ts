import { db, type Product } from './db';
import { ProductUnitCostHistoryService } from '../services/ProductUnitCostHistoryService';

const APP_NAME = 'Kalkulator Tekad Mandiri';
const LEGACY_APP_NAME = 'Inventory & Pricing Calculator';

const ensureSetting = async (key: string, value: string) => {
  const existing = await db.appSettings.get(key);
  if (!existing) {
    await db.appSettings.put({ key, value });
    return;
  }
  if (key === 'appName' && existing.value === LEGACY_APP_NAME) {
    await db.appSettings.put({ key, value });
  }
};

const ensureCoreSettings = async () => {
  await ensureSetting('appName', APP_NAME);
  await ensureSetting('defaultPpnRate', '11');
  await ensureSetting('currencyFormat', 'IDR');
  await ensureSetting('roundingMode', 'NEAREST_THOUSAND_500_THRESHOLD');

  const defaultMargin = await db.marginRules.where('ruleType').equals('STORE_DEFAULT').first();
  if (!defaultMargin) {
    await db.marginRules.add({
      id: 'rule-default',
      ruleType: 'STORE_DEFAULT',
      marginPercent: 15,
      priority: 5,
      isActive: true,
    });
  }
};

const ensureInitialCostHistories = async () => {
  const units = await db.productUnits.toArray();

  for (const unit of units) {
    if (!unit.id) continue;
    const existingHistory = await db.productUnitCostHistories.where('productUnitId').equals(unit.id).first();
    if (existingHistory) continue;

    const product = await db.products.get(unit.productId);
    await db.productUnitCostHistories.add(
      ProductUnitCostHistoryService.build({
        productId: unit.productId,
        productUnitId: unit.id,
        supplierId: product?.supplierId,
        inputCost: unit.manualCost,
        ppnMode: 'NO_PPN',
        ppnRate: 0,
        baseCost: unit.manualCost,
        ppnAmount: 0,
        finalCost: unit.manualCost,
        source: 'SEED',
        notes: 'Baseline modal dari data yang sudah ada',
        createdBy: 'System',
      }),
    );
  }
};

export const seedDatabase = async () => {
  const categoriesCount = await db.categories.count();
  if (categoriesCount > 0) {
    await ensureCoreSettings();
    await ensureInitialCostHistories();
    return;
  }

  await db.transaction('rw', [db.categories, db.brands, db.suppliers, db.products, db.productUnits, db.productUnitCostHistories, db.marginRules, db.appSettings], async () => {
    const categories = {
      mie: await db.categories.add({ name: 'Mie Instan', isActive: true }),
      minuman: await db.categories.add({ name: 'Minuman', isActive: true }),
      beras: await db.categories.add({ name: 'Beras', isActive: true }),
      minyak: await db.categories.add({ name: 'Minyak', isActive: true }),
      gula: await db.categories.add({ name: 'Gula', isActive: true }),
      rokok: await db.categories.add({ name: 'Rokok', isActive: true }),
      telur: await db.categories.add({ name: 'Telur', isActive: true }),
      bumbu: await db.categories.add({ name: 'Bumbu Dapur', isActive: true }),
    };

    const brands = {
      indomie: await db.brands.add({ name: 'Indomie', isActive: true }),
      sedaap: await db.brands.add({ name: 'Sedaap', isActive: true }),
      aqua: await db.brands.add({ name: 'Aqua', isActive: true }),
      sania: await db.brands.add({ name: 'Sania', isActive: true }),
      roseBrand: await db.brands.add({ name: 'Rose Brand', isActive: true }),
    };

    const suppliers = {
      utama: await db.suppliers.add({ name: 'Supplier Utama', isActive: true }),
      grosirA: await db.suppliers.add({ name: 'Supplier Grosir A', isActive: true }),
      pasar: await db.suppliers.add({ name: 'Supplier Pasar', isActive: true }),
    };

    const products: Product[] = [
      {
        id: 'prod-indomie-goreng',
        sku: 'SKU-001',
        name: 'Indomie Goreng',
        categoryId: categories.mie,
        brandId: brands.indomie,
        supplierId: suppliers.utama,
        pricingMode: 'AUTO_MARGIN',
        isActive: true,
      },
      {
        id: 'prod-mie-sedaap-soto',
        sku: 'SKU-002',
        name: 'Mie Sedaap Soto',
        categoryId: categories.mie,
        brandId: brands.sedaap,
        supplierId: suppliers.grosirA,
        pricingMode: 'AUTO_MARGIN',
        isActive: true,
      },
      {
        id: 'prod-aqua-600ml',
        sku: 'SKU-003',
        name: 'Aqua 600ml',
        categoryId: categories.minuman,
        brandId: brands.aqua,
        supplierId: suppliers.utama,
        barcode: '8992761111016',
        pricingMode: 'AUTO_MARGIN',
        isActive: true,
      },
      {
        id: 'prod-beras-ramos-5kg',
        sku: 'SKU-004',
        name: 'Beras Ramos 5kg',
        categoryId: categories.beras,
        supplierId: suppliers.grosirA,
        pricingMode: 'MANUAL_PRICE',
        isActive: true,
      },
      {
        id: 'prod-minyak-goreng-1l',
        sku: 'SKU-005',
        name: 'Minyak Goreng 1L',
        categoryId: categories.minyak,
        brandId: brands.sania,
        supplierId: suppliers.utama,
        pricingMode: 'AUTO_MARGIN',
        isActive: true,
      },
      {
        id: 'prod-gula-pasir-1kg',
        sku: 'SKU-006',
        name: 'Gula Pasir 1kg',
        categoryId: categories.gula,
        brandId: brands.roseBrand,
        supplierId: suppliers.grosirA,
        pricingMode: 'AUTO_MARGIN',
        isActive: true,
      },
      {
        id: 'prod-telur-ayam-1kg',
        sku: 'SKU-007',
        name: 'Telur Ayam 1kg',
        categoryId: categories.telur,
        supplierId: suppliers.pasar,
        pricingMode: 'LOCKED_PRICE',
        isActive: true,
        notes: 'Harga pasar harian',
      },
    ];

    await db.products.bulkAdd(products);

    const productUnits = [
      {
        id: 'unit-indomie-pcs',
        productId: 'prod-indomie-goreng',
        unitName: 'pcs',
        conversionToBase: 1,
        manualCost: 2800,
        activeSellingPrice: 3500,
        minSellingPrice: 3000,
        maxSellingPrice: 5000,
      },
      {
        id: 'unit-indomie-dus',
        productId: 'prod-indomie-goreng',
        unitName: 'dus',
        conversionToBase: 40,
        manualCost: 110000,
        activeSellingPrice: 125000,
        minSellingPrice: 115000,
        maxSellingPrice: 145000,
      },
      {
        id: 'unit-sedaap-pcs',
        productId: 'prod-mie-sedaap-soto',
        unitName: 'pcs',
        conversionToBase: 1,
        manualCost: 2700,
        activeSellingPrice: 3500,
        minSellingPrice: 3000,
        maxSellingPrice: 5000,
      },
      {
        id: 'unit-aqua-pcs',
        productId: 'prod-aqua-600ml',
        unitName: 'botol',
        conversionToBase: 1,
        manualCost: 2500,
        activeSellingPrice: 3500,
        minSellingPrice: 3000,
        maxSellingPrice: 4500,
      },
      {
        id: 'unit-beras-5kg',
        productId: 'prod-beras-ramos-5kg',
        unitName: 'pack',
        conversionToBase: 5,
        manualCost: 62000,
        activeSellingPrice: 68000,
        minSellingPrice: 65000,
        maxSellingPrice: 76000,
      },
      {
        id: 'unit-minyak-1l',
        productId: 'prod-minyak-goreng-1l',
        unitName: 'botol',
        conversionToBase: 1,
        manualCost: 14500,
        activeSellingPrice: 16000,
        minSellingPrice: 15000,
        maxSellingPrice: 18500,
      },
      {
        id: 'unit-gula-1kg',
        productId: 'prod-gula-pasir-1kg',
        unitName: 'pack',
        conversionToBase: 1,
        manualCost: 15500,
        activeSellingPrice: 17500,
        minSellingPrice: 16500,
        maxSellingPrice: 19500,
      },
      {
        id: 'unit-telur-1kg',
        productId: 'prod-telur-ayam-1kg',
        unitName: 'kg',
        conversionToBase: 1,
        manualCost: 27000,
        activeSellingPrice: 30000,
        minSellingPrice: 28500,
        maxSellingPrice: 34000,
      },
    ];

    await db.productUnits.bulkAdd(productUnits);

    await db.productUnitCostHistories.bulkAdd(
      productUnits.map(unit => {
        const product = products.find(item => item.id === unit.productId);
        return ProductUnitCostHistoryService.build({
          productId: unit.productId,
          productUnitId: unit.id,
          supplierId: product?.supplierId,
          inputCost: unit.manualCost,
          ppnMode: 'NO_PPN',
          ppnRate: 0,
          baseCost: unit.manualCost,
          ppnAmount: 0,
          finalCost: unit.manualCost,
          source: 'SEED',
          notes: 'Modal awal sample data',
          createdBy: 'System',
        });
      }),
    );

    await db.marginRules.bulkAdd([
      {
        id: 'rule-default',
        ruleType: 'STORE_DEFAULT',
        marginPercent: 15,
        priority: 5,
        isActive: true,
      },
      {
        id: 'rule-cat-mie',
        ruleType: 'CATEGORY',
        referenceId: categories.mie.toString(),
        marginPercent: 10,
        priority: 4,
        isActive: true,
      },
      {
        id: 'rule-cat-minuman',
        ruleType: 'CATEGORY',
        referenceId: categories.minuman.toString(),
        marginPercent: 15,
        priority: 4,
        isActive: true,
      },
      {
        id: 'rule-cat-beras',
        ruleType: 'CATEGORY',
        referenceId: categories.beras.toString(),
        marginPercent: 6,
        priority: 4,
        isActive: true,
      },
      {
        id: 'rule-cat-minyak',
        ruleType: 'CATEGORY',
        referenceId: categories.minyak.toString(),
        marginPercent: 7,
        priority: 4,
        isActive: true,
      },
      {
        id: 'rule-cat-rokok',
        ruleType: 'CATEGORY',
        referenceId: categories.rokok.toString(),
        marginPercent: 5,
        priority: 4,
        isActive: true,
      },
    ]);

    await db.appSettings.bulkAdd([
      { key: 'appName', value: APP_NAME },
      { key: 'defaultPpnRate', value: '11' },
      { key: 'currencyFormat', value: 'IDR' },
      { key: 'roundingMode', value: 'NEAREST_THOUSAND_500_THRESHOLD' },
    ]);
  });
};
