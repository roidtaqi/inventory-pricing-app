import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, Pencil, Plus, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { db, type Brand, type Category, type Supplier } from '../db/db';

type MasterTab = 'categories' | 'brands' | 'suppliers';
type MasterItem = Category | Brand | Supplier;

const isSupplier = (item: MasterItem): item is Supplier => {
  return 'phone' in item || 'address' in item;
};

const tabs: Array<{ id: MasterTab; label: string }> = [
  { id: 'categories', label: 'Kategori' },
  { id: 'brands', label: 'Brand' },
  { id: 'suppliers', label: 'Supplier' },
];

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<MasterTab>('categories');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [search, setSearch] = useState('');

  const loadedCategories = useLiveQuery(() => db.categories.toArray());
  const loadedBrands = useLiveQuery(() => db.brands.toArray());
  const loadedSuppliers = useLiveQuery(() => db.suppliers.toArray());

  const categories = useMemo(() => loadedCategories ?? [], [loadedCategories]);
  const brands = useMemo(() => loadedBrands ?? [], [loadedBrands]);
  const suppliers = useMemo(() => loadedSuppliers ?? [], [loadedSuppliers]);

  const activeItems = useMemo(() => {
    if (activeTab === 'categories') return categories;
    if (activeTab === 'brands') return brands;
    return suppliers;
  }, [activeTab, brands, categories, suppliers]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return activeItems
      .filter(item => !keyword || item.name.toLowerCase().includes(keyword))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [activeItems, search]);

  const handleTabChange = (tab: MasterTab) => {
    setActiveTab(tab);
    resetForm();
    setSearch('');
  };

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setPhoneInput('');
    setAddressInput('');
    setIsActiveInput(true);
  };

  const startEdit = (item: MasterItem) => {
    setEditingId(item.id ?? null);
    setNameInput(item.name);
    setIsActiveInput(item.isActive);

    if (isSupplier(item)) {
      setPhoneInput(item.phone ?? '');
      setAddressInput(item.address ?? '');
    } else {
      setPhoneInput('');
      setAddressInput('');
    }
  };

  const hasDuplicateName = (name: string) => {
    return activeItems.some(item => item.name.trim().toLowerCase() === name.trim().toLowerCase() && item.id !== editingId);
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) {
      alert('Nama wajib diisi');
      return;
    }
    if (hasDuplicateName(name)) {
      alert('Nama sudah ada');
      return;
    }

    try {
      if (activeTab === 'categories') {
        const payload: Category = { id: editingId ?? undefined, name, isActive: isActiveInput };
        await db.categories.put(payload);
      }
      if (activeTab === 'brands') {
        const payload: Brand = { id: editingId ?? undefined, name, isActive: isActiveInput };
        await db.brands.put(payload);
      }
      if (activeTab === 'suppliers') {
        const payload: Supplier = {
          id: editingId ?? undefined,
          name,
          phone: phoneInput.trim() || undefined,
          address: addressInput.trim() || undefined,
          isActive: isActiveInput,
        };
        await db.suppliers.put(payload);
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan master data');
    }
  };

  const itemTypeLabel = tabs.find(tab => tab.id === activeTab)?.label ?? 'Data';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/more" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Master Data</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="grid grid-cols-3 rounded-lg border border-border bg-surface p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={clsx(
                'h-10 rounded-md text-sm font-semibold transition-colors',
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-primary">{editingId ? `Edit ${itemTypeLabel}` : `Tambah ${itemTypeLabel}`}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-md p-2 text-textMuted hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nama *</label>
            <input className="input" value={nameInput} onChange={event => setNameInput(event.target.value)} />
          </div>

          {activeTab === 'suppliers' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Telepon</label>
                <input className="input" value={phoneInput} onChange={event => setPhoneInput(event.target.value)} inputMode="tel" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea className="input min-h-20 resize-none" value={addressInput} onChange={event => setAddressInput(event.target.value)} />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isActiveInput} onChange={event => setIsActiveInput(event.target.checked)} className="h-4 w-4" />
            Aktif
          </label>

          <button type="button" onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Simpan Perubahan' : `Tambah ${itemTypeLabel}`}
          </button>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-textMuted" />
          </div>
          <input
            type="text"
            className="input pl-10"
            placeholder={`Cari ${itemTypeLabel.toLowerCase()}...`}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        <div className="space-y-3">
          {filteredItems.map(item => (
            <div key={item.id} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold text-textMain">{item.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-textMuted">
                  <span className={clsx('rounded px-2 py-0.5 font-medium', item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                    {item.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                  {isSupplier(item) && item.phone && <span>{item.phone}</span>}
                </div>
              </div>
              <button type="button" onClick={() => startEdit(item)} className="rounded-md p-2 text-textMuted hover:bg-gray-100 hover:text-primary">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="card py-8 text-center text-sm text-textMuted">
              Tidak ada data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
