import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type ProductUnit } from '../db/db';
import { ArrowLeft, Camera, Plus, Save, ScanLine, Trash2 } from 'lucide-react';
import { ProductUnitCostHistoryService } from '../services/ProductUnitCostHistoryService';
import { PriceHistoryService } from '../services/PriceHistoryService';
import { authService } from '../services/AuthService';
import { formatCurrency } from '../utils/format';
import { useAppAlert } from '../components/AppAlertContext';

type ProductFormTab = 'info' | 'units' | 'costHistory';

const CameraBarcodeScanner = lazy(() =>
  import('../components/CameraBarcodeScanner').then(module => ({ default: module.CameraBarcodeScanner })),
);

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { showAlert } = useAppAlert();
  const currentUser = authService.getCurrentUser();
  const canEditActiveSellingPrice = authService.canApprove(currentUser);

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const brands = useLiveQuery(() => db.brands.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const loadedCostHistories = useLiveQuery(
    () => isEdit && id ? db.productUnitCostHistories.where('productId').equals(id).toArray() : [],
    [isEdit, id],
  );

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [barcode, setBarcode] = useState('');
  const [pricingMode, setPricingMode] = useState<'AUTO_MARGIN' | 'MANUAL_PRICE' | 'LOCKED_PRICE'>('AUTO_MARGIN');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  
  const [units, setUnits] = useState<Partial<ProductUnit>[]>([]);
  const [activeTab, setActiveTab] = useState<ProductFormTab>('info');
  const costHistories = (loadedCostHistories ?? []).sort((a, b) => b.createdAt - a.createdAt);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerBufferRef = useRef('');
  const lastScannerKeyAtRef = useRef(0);

  useEffect(() => {
    if (isEdit && id) {
      db.products.get(id).then(product => {
        if (product) {
          setSku(product.sku);
          setName(product.name);
          setCategoryId(product.categoryId || '');
          setBrandId(product.brandId || '');
          setSupplierId(product.supplierId || '');
          setBarcode(product.barcode || '');
          setPricingMode(product.pricingMode);
          setIsActive(product.isActive);
          setNotes(product.notes || '');
        }
      });
      db.productUnits.where('productId').equals(id).toArray().then(u => {
        setUnits(u);
      });
    }
  }, [isEdit, id]);

  const handleAddUnit = () => {
    setUnits([...units, { 
      unitName: '', 
      conversionToBase: 1, 
      manualCost: 0, 
      activeSellingPrice: 0 
    }]);
  };

  const handleUpdateUnit = <K extends keyof ProductUnit>(index: number, field: K, value: ProductUnit[K]) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const handleRemoveUnit = (index: number) => {
    const newUnits = [...units];
    newUnits.splice(index, 1);
    setUnits(newUnits);
  };

  const handleDetectedBarcode = useCallback(async (rawBarcode: string) => {
    const scannedBarcode = rawBarcode.trim();
    if (!scannedBarcode) return false;

    const duplicateBarcode = await db.products
      .filter(product => product.barcode === scannedBarcode && product.id !== id)
      .first();
    if (duplicateBarcode) {
      showAlert({
        tone: 'warning',
        title: 'Barcode Sudah Ada',
        message: `Barcode ini sudah digunakan oleh produk "${duplicateBarcode.name}".`,
      });
      return false;
    }

    setBarcode(scannedBarcode);
    setActiveTab('info');
    return true;
  }, [id, showAlert]);

  useEffect(() => {
    const handleScannerKeyDown = (event: KeyboardEvent) => {
      if (showCameraScanner) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable = target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      if (isEditable) return;

      const now = Date.now();
      if (now - lastScannerKeyAtRef.current > 80) {
        scannerBufferRef.current = '';
      }

      if (event.key === 'Enter') {
        const scannedBarcode = scannerBufferRef.current.trim();
        scannerBufferRef.current = '';
        if (scannedBarcode.length >= 3) {
          event.preventDefault();
          void handleDetectedBarcode(scannedBarcode);
        }
        return;
      }

      if (event.key.length === 1) {
        scannerBufferRef.current += event.key;
        lastScannerKeyAtRef.current = now;
      }
    };

    window.addEventListener('keydown', handleScannerKeyDown);
    return () => window.removeEventListener('keydown', handleScannerKeyDown);
  }, [handleDetectedBarcode, showCameraScanner]);

  const handleSave = async () => {
    const productId = id || crypto.randomUUID();
    const trimmedSku = sku.trim();
    const trimmedName = name.trim();
    const trimmedBarcode = barcode.trim();

    if (!trimmedName || !trimmedSku) {
      showAlert({ tone: 'warning', title: 'Periksa Produk', message: 'Nama dan SKU wajib diisi.' });
      return;
    }
    if (units.length === 0) {
      showAlert({ tone: 'warning', title: 'Periksa Produk', message: 'Minimal harus memiliki satu satuan.' });
      return;
    }
    for (const unit of units) {
      if (!unit.unitName?.trim()) {
        showAlert({ tone: 'warning', title: 'Periksa Satuan', message: 'Nama satuan wajib diisi.' });
        return;
      }
      if (!unit.conversionToBase || unit.conversionToBase <= 0) {
        showAlert({ tone: 'warning', title: 'Periksa Satuan', message: 'Konversi satuan harus lebih dari 0.' });
        return;
      }
      if (!unit.manualCost || unit.manualCost <= 0) {
        showAlert({ tone: 'warning', title: 'Periksa Satuan', message: 'Harga modal manual harus lebih dari 0.' });
        return;
      }
      if (!unit.activeSellingPrice || unit.activeSellingPrice <= 0) {
        showAlert({ tone: 'warning', title: 'Periksa Satuan', message: 'Harga jual aktif harus lebih dari 0.' });
        return;
      }
      if (
        unit.minSellingPrice !== undefined &&
        unit.maxSellingPrice !== undefined &&
        unit.minSellingPrice > unit.maxSellingPrice
      ) {
        showAlert({ tone: 'warning', title: 'Periksa Satuan', message: 'Harga minimum tidak boleh lebih besar dari harga maksimum.' });
        return;
      }
    }

    try {
      const existingSku = await db.products.where('sku').equals(trimmedSku).first();
      if (existingSku && existingSku.id !== productId) {
        showAlert({ tone: 'warning', title: 'SKU Duplikat', message: 'SKU sudah digunakan produk lain.' });
        return;
      }

      if (trimmedBarcode) {
        const duplicateBarcode = await db.products
          .filter(product => product.barcode === trimmedBarcode && product.id !== productId)
          .first();
        if (duplicateBarcode) {
          showAlert({ tone: 'warning', title: 'Barcode Duplikat', message: 'Barcode sudah digunakan produk lain.' });
          return;
        }
      }

      const existingUnitsForValidation = await db.productUnits.where('productId').equals(productId).toArray();
      const hasExistingActivePriceChange = units.some(unit => {
        const existingUnit = unit.id ? existingUnitsForValidation.find(item => item.id === unit.id) : undefined;
        return Boolean(existingUnit && existingUnit.activeSellingPrice !== Number(unit.activeSellingPrice));
      });
      const hasNewActivePrice = units.some(unit => {
        const existingUnit = unit.id ? existingUnitsForValidation.find(item => item.id === unit.id) : undefined;
        return !existingUnit && Number(unit.activeSellingPrice) > 0;
      });
      if ((hasExistingActivePriceChange || hasNewActivePrice) && !canEditActiveSellingPrice) {
        showAlert({
          tone: 'warning',
          title: 'Akses Harga Aktif',
          message: 'Harga jual aktif hanya bisa diubah Owner. Gunakan Kalkulator lalu Ajukan Approval untuk perubahan harga.',
        });
        return;
      }
      if (hasExistingActivePriceChange && !priceChangeReason.trim()) {
        showAlert({
          tone: 'warning',
          title: 'Alasan Diperlukan',
          message: 'Isi alasan perubahan harga jual aktif agar riwayat harga dapat diaudit.',
        });
        return;
      }

      await db.transaction('rw', db.products, db.productUnits, db.productUnitCostHistories, db.priceHistories, async () => {
        const productData: Product = {
          id: productId,
          sku: trimmedSku,
          name: trimmedName,
          categoryId: categoryId ? Number(categoryId) : undefined,
          brandId: brandId ? Number(brandId) : undefined,
          supplierId: supplierId ? Number(supplierId) : undefined,
          barcode: trimmedBarcode || undefined,
          pricingMode,
          isActive,
          notes: notes.trim() || undefined,
        };

        await db.products.put(productData);

        const existingUnits = await db.productUnits.where('productId').equals(productId).toArray();
        const nextUnitIds = new Set<string>();

        for (const u of units) {
            const unitId = u.id || crypto.randomUUID();
            const existingUnit = existingUnits.find(unit => unit.id === unitId);
            const unitData: ProductUnit = {
                id: unitId,
                productId,
                unitName: u.unitName!.trim(),
                conversionToBase: Number(u.conversionToBase),
                manualCost: Number(u.manualCost),
                activeSellingPrice: canEditActiveSellingPrice || !existingUnit ? Number(u.activeSellingPrice) : existingUnit.activeSellingPrice,
                minSellingPrice: u.minSellingPrice,
                maxSellingPrice: u.maxSellingPrice,
            };

            await db.productUnits.put(unitData);
            nextUnitIds.add(unitId);

            if (existingUnit && existingUnit.activeSellingPrice !== unitData.activeSellingPrice) {
              await db.priceHistories.add(
                PriceHistoryService.buildFromManualPriceChange({
                  productId,
                  productUnitId: unitId,
                  oldCost: existingUnit.manualCost,
                  newCost: unitData.manualCost,
                  oldPrice: existingUnit.activeSellingPrice,
                  newPrice: unitData.activeSellingPrice,
                  pricingMode: productData.pricingMode,
                  changeReason: priceChangeReason.trim(),
                  changedBy: currentUser?.name ?? 'Owner',
                }),
              );
            }

            if (!existingUnit || existingUnit.manualCost !== unitData.manualCost) {
              await db.productUnitCostHistories.add(
                ProductUnitCostHistoryService.build({
                  productId,
                  productUnitId: unitId,
                  supplierId: productData.supplierId,
                  inputCost: unitData.manualCost,
                  ppnMode: 'NO_PPN',
                  ppnRate: 0,
                  baseCost: unitData.manualCost,
                  ppnAmount: 0,
                  finalCost: unitData.manualCost,
                  previousFinalCost: existingUnit?.manualCost,
                  source: 'PRODUCT_FORM',
                  notes: existingUnit ? 'Update modal dari form produk' : 'Modal awal dari form produk',
                  createdBy: currentUser?.name ?? 'User POS',
                }),
              );
            }
        }

        for (const existingUnit of existingUnits) {
          if (existingUnit.id && !nextUnitIds.has(existingUnit.id)) {
            await db.productUnits.delete(existingUnit.id);
          }
        }
      });
      window.dispatchEvent(new CustomEvent('inventory-catalog-changed'));
      navigate('/products');
    } catch (error) {
      console.error(error);
      showAlert({ tone: 'error', title: 'Gagal Menyimpan', message: 'Produk belum berhasil disimpan. Coba periksa input dan ulangi lagi.' });
    }
  };

  const getUnitName = (unitId: string) => {
    return units.find(unit => unit.id === unitId)?.unitName || 'Satuan lama';
  };

  const getSourceLabel = (source: string) => {
    if (source === 'APPROVAL') return 'Approval';
    if (source === 'CSV_IMPORT') return 'CSV';
    if (source === 'SEED') return 'Sample';
    return 'Form Produk';
  };

  const productTabs: Array<{ id: ProductFormTab; label: string }> = [
    { id: 'info', label: 'Info' },
    { id: 'units', label: `Satuan (${units.length})` },
    ...(isEdit ? [{ id: 'costHistory' as const, label: `Riwayat (${costHistories.length})` }] : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-textMain" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h1>
            {sku && <div className="text-xs text-textMuted">{sku}</div>}
          </div>
          <button onClick={handleSave} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
            <Save className="h-4 w-4" />
            Simpan
          </button>
        </div>

        <div className="grid gap-1 px-4 pb-3" style={{ gridTemplateColumns: `repeat(${productTabs.length}, minmax(0, 1fr))` }}>
          {productTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 rounded-md text-xs font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-textMuted hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        {activeTab === 'info' && (
          <>
            <div className="card space-y-3">
              <h2 className="font-bold text-primary">Informasi Dasar</h2>
              <div>
                <label className="block text-sm font-medium mb-1">SKU *</label>
                <input className="input" value={sku} onChange={e => setSku(e.target.value)} placeholder="Contoh: IND-001" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Produk *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Indomie Goreng" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Barcode</label>
                <div className="flex gap-2">
                  <input
                    ref={barcodeInputRef}
                    className="input"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="Opsional"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      barcodeInputRef.current?.focus();
                      barcodeInputRef.current?.select();
                    }}
                    className="btn-secondary flex h-10 w-10 shrink-0 items-center justify-center p-0"
                    title="Fokus barcode untuk scanner laser"
                  >
                    <ScanLine className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="btn-secondary flex h-10 w-10 shrink-0 items-center justify-center p-0 text-primary"
                    title="Scan barcode dengan kamera"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mode Pricing</label>
                <select className="input" value={pricingMode} onChange={e => setPricingMode(e.target.value as Product['pricingMode'])}>
                  <option value="AUTO_MARGIN">Auto Margin</option>
                  <option value="MANUAL_PRICE">Manual Price</option>
                  <option value="LOCKED_PRICE">Locked Price</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pt-1 text-sm font-medium">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4" />
                Produk aktif
              </label>
              <div>
                <label className="block text-sm font-medium mb-1">Catatan</label>
                <textarea className="input min-h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" />
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="font-bold text-primary">Klasifikasi</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Kategori</label>
                <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Pilih Kategori...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand</label>
                <select className="input" value={brandId} onChange={e => setBrandId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Pilih Brand...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Pilih Supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {activeTab === 'units' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="font-bold text-primary">Satuan Produk</h2>
              <button onClick={handleAddUnit} className="text-primary text-sm font-medium flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                <Plus className="w-4 h-4" /> Tambah Satuan
              </button>
            </div>

            {canEditActiveSellingPrice ? (
              <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800">
                <label className="block font-semibold mb-1">Alasan Perubahan Harga Jual Aktif</label>
                <textarea
                  className="input min-h-20 resize-none bg-white"
                  value={priceChangeReason}
                  onChange={event => setPriceChangeReason(event.target.value)}
                  placeholder="Wajib diisi jika mengubah harga jual aktif"
                />
              </div>
            ) : (
              <div className="card border-amber-200 bg-amber-50 text-sm leading-6 text-amber-800">
                Harga Jual Aktif hanya dapat diubah Owner. Gunakan Kalkulator lalu Ajukan Approval untuk perubahan harga.
              </div>
            )}

            {units.length === 0 && (
              <div className="card text-center text-sm text-textMuted py-6">Belum ada satuan ditambahkan</div>
            )}

            {units.map((unit, index) => (
              <div key={unit.id ?? index} className="card relative border-l-4 border-l-primary space-y-3">
                <button
                  onClick={() => handleRemoveUnit(index)}
                  className="absolute top-3 right-3 text-danger hover:bg-red-50 p-1 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="pr-8">
                  <label className="block text-xs font-medium mb-1">Nama Satuan (mis: pcs, dus)</label>
                  <input className="input py-1.5 text-sm" value={unit.unitName} onChange={e => handleUpdateUnit(index, 'unitName', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Konversi ke Dasar</label>
                    <input type="number" className="input py-1.5 text-sm" value={unit.conversionToBase} onChange={e => handleUpdateUnit(index, 'conversionToBase', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Harga Modal Manual</label>
                    <input type="number" className="input py-1.5 text-sm" value={unit.manualCost} onChange={e => handleUpdateUnit(index, 'manualCost', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Harga Jual Aktif</label>
                    <input
                      type="number"
                      className="input py-1.5 text-sm disabled:bg-gray-100 disabled:text-textMuted"
                      value={unit.activeSellingPrice}
                      disabled={!canEditActiveSellingPrice}
                      onChange={e => handleUpdateUnit(index, 'activeSellingPrice', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Harga Min & Max</label>
                    <div className="flex gap-1">
                      <input type="number" className="input py-1.5 text-sm w-full" placeholder="Min" value={unit.minSellingPrice || ''} onChange={e => handleUpdateUnit(index, 'minSellingPrice', e.target.value ? Number(e.target.value) : undefined)} />
                      <input type="number" className="input py-1.5 text-sm w-full" placeholder="Max" value={unit.maxSellingPrice || ''} onChange={e => handleUpdateUnit(index, 'maxSellingPrice', e.target.value ? Number(e.target.value) : undefined)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'costHistory' && isEdit && (
          <div className="space-y-3">
            <h2 className="px-1 font-bold text-primary">Riwayat Modal</h2>
            {costHistories.length === 0 && (
              <div className="card text-center text-sm text-textMuted py-8">
                Belum ada riwayat modal
              </div>
            )}
            {costHistories.map(history => (
              <div key={history.id} className="card text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-textMain">{getUnitName(history.productUnitId)}</div>
                    <div className="mt-0.5 text-xs text-textMuted">
                      {new Date(history.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-primary">
                    {getSourceLabel(history.source)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded bg-gray-50 p-2">
                    <div className="text-xs text-textMuted">Modal Sebelumnya</div>
                    <div className="font-medium text-textMain">{history.previousFinalCost === undefined ? '-' : formatCurrency(history.previousFinalCost)}</div>
                  </div>
                  <div className="rounded bg-emerald-50 p-2">
                    <div className="text-xs text-textMuted">Modal Baru</div>
                    <div className="font-bold text-emerald-700">{formatCurrency(history.finalCost)}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-textMuted">
                  PPN: {history.ppnMode.replace('_', ' ')} ({formatCurrency(history.ppnAmount)})
                </div>
                {history.notes && (
                  <div className="mt-2 text-xs text-textMuted">{history.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCameraScanner && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 text-sm font-bold text-white">
              Membuka kamera...
            </div>
          }
        >
          <CameraBarcodeScanner
            onClose={() => setShowCameraScanner(false)}
            onDetected={handleDetectedBarcode}
          />
        </Suspense>
      )}
    </div>
  );
}
