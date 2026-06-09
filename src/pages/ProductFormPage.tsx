import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type ProductUnit } from '../db/db';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { ProductUnitCostHistoryService } from '../services/ProductUnitCostHistoryService';
import { formatCurrency } from '../utils/format';

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

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
  
  const [units, setUnits] = useState<Partial<ProductUnit>[]>([]);
  const costHistories = (loadedCostHistories ?? []).sort((a, b) => b.createdAt - a.createdAt);

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

  const handleSave = async () => {
    const productId = id || crypto.randomUUID();
    const trimmedSku = sku.trim();
    const trimmedName = name.trim();
    const trimmedBarcode = barcode.trim();

    if (!trimmedName || !trimmedSku) {
      alert("Nama dan SKU wajib diisi");
      return;
    }
    if (units.length === 0) {
      alert("Minimal harus memiliki satu satuan");
      return;
    }
    for (const unit of units) {
      if (!unit.unitName?.trim()) {
        alert("Nama satuan wajib diisi");
        return;
      }
      if (!unit.conversionToBase || unit.conversionToBase <= 0) {
        alert("Konversi satuan harus lebih dari 0");
        return;
      }
      if (!unit.manualCost || unit.manualCost <= 0) {
        alert("Harga modal manual harus lebih dari 0");
        return;
      }
      if (!unit.activeSellingPrice || unit.activeSellingPrice <= 0) {
        alert("Harga jual aktif harus lebih dari 0");
        return;
      }
      if (
        unit.minSellingPrice !== undefined &&
        unit.maxSellingPrice !== undefined &&
        unit.minSellingPrice > unit.maxSellingPrice
      ) {
        alert("Harga minimum tidak boleh lebih besar dari harga maksimum");
        return;
      }
    }

    try {
      const existingSku = await db.products.where('sku').equals(trimmedSku).first();
      if (existingSku && existingSku.id !== productId) {
        alert("SKU sudah digunakan produk lain");
        return;
      }

      if (trimmedBarcode) {
        const duplicateBarcode = await db.products
          .filter(product => product.barcode === trimmedBarcode && product.id !== productId)
          .first();
        if (duplicateBarcode) {
          alert("Barcode sudah digunakan produk lain");
          return;
        }
      }

      await db.transaction('rw', db.products, db.productUnits, db.productUnitCostHistories, async () => {
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
                activeSellingPrice: Number(u.activeSellingPrice),
                minSellingPrice: u.minSellingPrice,
                maxSellingPrice: u.maxSellingPrice,
            };

            await db.productUnits.put(unitData);
            nextUnitIds.add(unitId);

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
                  createdBy: 'Admin Lokal',
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
      navigate('/products');
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan produk");
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

  return (
    <div className="bg-background min-h-screen pb-20">
      <div className="bg-surface border-b border-border p-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-textMain" />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
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
            <input className="input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Opsional" />
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

        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="font-bold text-primary">Satuan Produk</h2>
            <button onClick={handleAddUnit} className="text-primary text-sm font-medium flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
              <Plus className="w-4 h-4" /> Tambah Satuan
            </button>
          </div>
          
          {units.length === 0 && (
            <div className="card text-center text-sm text-textMuted py-6">Belum ada satuan ditambahkan</div>
          )}

          {units.map((unit, index) => (
            <div key={index} className="card relative border-l-4 border-l-primary space-y-3">
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
                  <input type="number" className="input py-1.5 text-sm" value={unit.activeSellingPrice} onChange={e => handleUpdateUnit(index, 'activeSellingPrice', Number(e.target.value))} />
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

        {isEdit && (
          <div className="card space-y-3">
            <h2 className="font-bold text-primary">Riwayat Modal</h2>
            {costHistories.length === 0 && (
              <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-textMuted">
                Belum ada riwayat modal
              </div>
            )}
            {costHistories.map(history => (
              <div key={history.id} className="rounded-lg border border-border p-3 text-sm">
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

        <button onClick={handleSave} className="btn-primary w-full py-3 mt-4 text-lg">
          Simpan Produk
        </button>
      </div>
    </div>
  );
}
