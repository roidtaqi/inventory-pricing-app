import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MarginRule } from '../db/db';
import { ArrowLeft, Save } from 'lucide-react';
import { useAppAlert } from '../components/AppAlertContext';

const findExistingMarginRule = (
  rules: MarginRule[],
  ruleType: MarginRule['ruleType'],
  referenceId: string,
) => {
  if (ruleType !== 'STORE_DEFAULT' && !referenceId) return undefined;

  return rules
    .filter(rule => {
      if (rule.ruleType !== ruleType) return false;
      if (rule.ruleType === 'STORE_DEFAULT') return true;
      return rule.referenceId?.toString() === referenceId;
    })
    .sort((a, b) => (
      Number(b.isActive) - Number(a.isActive)
      || (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? '')
    ))[0];
};

export default function MarginRuleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { showAlert } = useAppAlert();

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const brands = useLiveQuery(() => db.brands.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const loadedMarginRules = useLiveQuery(() => db.marginRules.toArray());
  const marginRules = useMemo(() => loadedMarginRules ?? [], [loadedMarginRules]);

  const [ruleType, setRuleType] = useState<MarginRule['ruleType']>('CATEGORY');
  const [referenceId, setReferenceId] = useState<string>('');
  const [marginPercent, setMarginPercent] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [effectiveUntil, setEffectiveUntil] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (isEdit && id) {
      db.marginRules.get(id).then(rule => {
        if (rule) {
          setRuleType(rule.ruleType);
          setReferenceId(rule.referenceId?.toString() || '');
          setMarginPercent(rule.marginPercent.toString());
          setEffectiveFrom(rule.effectiveFrom || '');
          setEffectiveUntil(rule.effectiveUntil || '');
          setIsActive(rule.isActive);
        }
      });
    }
  }, [isEdit, id]);

  const existingRuleForSelection = useMemo(() => {
    if (isEdit) return undefined;
    return findExistingMarginRule(marginRules, ruleType, referenceId);
  }, [isEdit, marginRules, referenceId, ruleType]);

  const clearNewRuleValues = () => {
    setMarginPercent('');
    setEffectiveFrom('');
    setEffectiveUntil('');
    setIsActive(true);
  };

  const applyExistingRuleValues = (type: MarginRule['ruleType'], targetId: string) => {
    if (isEdit) return;

    const existingRule = findExistingMarginRule(marginRules, type, targetId);
    if (!existingRule) {
      clearNewRuleValues();
      return;
    }

    setMarginPercent(existingRule.marginPercent.toString());
    setEffectiveFrom(existingRule.effectiveFrom || '');
    setEffectiveUntil(existingRule.effectiveUntil || '');
    setIsActive(existingRule.isActive);
  };

  const handleRuleTypeChange = (type: MarginRule['ruleType']) => {
    setRuleType(type);
    setReferenceId('');

    if (type === 'STORE_DEFAULT') {
      applyExistingRuleValues(type, '');
    } else if (!isEdit) {
      clearNewRuleValues();
    }
  };

  const handleReferenceChange = (targetId: string) => {
    setReferenceId(targetId);
    applyExistingRuleValues(ruleType, targetId);
  };

  const getPriority = (type: MarginRule['ruleType']) => {
    switch(type) {
        case 'PRODUCT': return 1;
        case 'BRAND': return 2;
        case 'SUPPLIER': return 3;
        case 'CATEGORY': return 4;
        case 'STORE_DEFAULT': return 5;
    }
  };

  const handleSave = async () => {
    const parsedMargin = parseFloat(marginPercent);
    if (!marginPercent || !Number.isFinite(parsedMargin)) {
      showAlert({ tone: 'warning', title: 'Periksa Margin', message: 'Margin wajib diisi.' });
      return;
    }
    if (parsedMargin <= 0 || parsedMargin >= 100) {
      showAlert({ tone: 'warning', title: 'Periksa Margin', message: 'Margin harus lebih dari 0 dan kurang dari 100%.' });
      return;
    }
    if (ruleType !== 'STORE_DEFAULT' && !referenceId) {
        showAlert({ tone: 'warning', title: 'Periksa Target', message: 'Referensi target wajib dipilih.' });
        return;
    }
    if (effectiveFrom && effectiveUntil && effectiveFrom > effectiveUntil) {
      showAlert({ tone: 'warning', title: 'Periksa Tanggal', message: 'Tanggal mulai tidak boleh lebih akhir dari tanggal akhir.' });
      return;
    }

    try {
      const marginRuleData: MarginRule = {
        id: id || existingRuleForSelection?.id || crypto.randomUUID(),
        ruleType,
        referenceId: ruleType === 'STORE_DEFAULT' ? undefined : referenceId,
        marginPercent: parsedMargin,
        priority: getPriority(ruleType),
        effectiveFrom: effectiveFrom || undefined,
        effectiveUntil: effectiveUntil || undefined,
        isActive
      };
      await db.marginRules.put(marginRuleData);
      navigate('/margin');
    } catch (error) {
      console.error(error);
      showAlert({ tone: 'error', title: 'Gagal Menyimpan', message: 'Aturan margin belum berhasil disimpan. Coba ulangi lagi.' });
    }
  };

  return (
    <div className="bg-background min-h-screen pb-24">
      <div className="bg-surface border-b border-border p-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-textMain" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{isEdit ? 'Edit Margin' : 'Tambah Margin'}</h1>
        <button onClick={handleSave} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
          <Save className="h-4 w-4" />
          Simpan
        </button>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <div className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipe Aturan</label>
            <select className="input" value={ruleType} onChange={e => handleRuleTypeChange(e.target.value as MarginRule['ruleType'])}>
              <option value="STORE_DEFAULT">Store Default</option>
              <option value="CATEGORY">Kategori</option>
              <option value="BRAND">Brand</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="PRODUCT">Produk Spesifik</option>
            </select>
          </div>

          {ruleType === 'CATEGORY' && (
            <div>
              <label className="block text-sm font-medium mb-1">Target Kategori</label>
              <select className="input" value={referenceId} onChange={e => handleReferenceChange(e.target.value)}>
                <option value="">Pilih Kategori...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {ruleType === 'BRAND' && (
            <div>
              <label className="block text-sm font-medium mb-1">Target Brand</label>
              <select className="input" value={referenceId} onChange={e => handleReferenceChange(e.target.value)}>
                <option value="">Pilih Brand...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {ruleType === 'SUPPLIER' && (
            <div>
              <label className="block text-sm font-medium mb-1">Target Supplier</label>
              <select className="input" value={referenceId} onChange={e => handleReferenceChange(e.target.value)}>
                <option value="">Pilih Supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {ruleType === 'PRODUCT' && (
            <div>
              <label className="block text-sm font-medium mb-1">Target Produk</label>
              <select className="input" value={referenceId} onChange={e => handleReferenceChange(e.target.value)}>
                <option value="">Pilih Produk...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Margin (%) dari Harga Jual</label>
            <input type="number" className="input" value={marginPercent} onChange={e => setMarginPercent(e.target.value)} placeholder="Contoh: 15" />
          </div>

          {existingRuleForSelection && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800">
              Target ini sudah punya aturan margin. Nilai tersimpan dimuat otomatis dan akan diperbarui saat disimpan.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Mulai Berlaku</label>
              <input type="date" className="input" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Akhir Berlaku</label>
              <input type="date" className="input" value={effectiveUntil} onChange={e => setEffectiveUntil(e.target.value)} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-primary" />
            <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Aturan Aktif</label>
          </div>
        </div>

        <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
          Prioritas otomatis: Product, Brand, Supplier, Kategori, Default.
        </div>
      </div>
    </div>
  );
}
