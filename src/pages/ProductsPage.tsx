import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [pricingModeFilter, setPricingModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  
  const loadedProducts = useLiveQuery(() => db.products.toArray());
  const products = useMemo(() => loadedProducts ?? [], [loadedProducts]);
  const units = useLiveQuery(() => db.productUnits.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const brands = useLiveQuery(() => db.brands.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter(product => {
      if (keyword && !product.name.toLowerCase().includes(keyword) && !product.sku.toLowerCase().includes(keyword)) {
        return false;
      }
      if (categoryFilter && product.categoryId?.toString() !== categoryFilter) return false;
      if (brandFilter && product.brandId?.toString() !== brandFilter) return false;
      if (supplierFilter && product.supplierId?.toString() !== supplierFilter) return false;
      if (pricingModeFilter && product.pricingMode !== pricingModeFilter) return false;
      if (statusFilter === 'active' && !product.isActive) return false;
      if (statusFilter === 'inactive' && product.isActive) return false;
      return true;
    });
  }, [brandFilter, categoryFilter, pricingModeFilter, products, search, statusFilter, supplierFilter]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const activeFilterCount = [categoryFilter, brandFilter, supplierFilter, pricingModeFilter, statusFilter !== 'active' ? statusFilter : ''].filter(Boolean).length;

  const resetVisibleCount = () => setVisibleCount(PAGE_SIZE);
  const clearFilters = () => {
    setCategoryFilter('');
    setBrandFilter('');
    setSupplierFilter('');
    setPricingModeFilter('');
    setStatusFilter('active');
    resetVisibleCount();
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-primary">Produk</h1>
        <Link to="/products/new" className="bg-primary text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition">
          <Plus className="w-5 h-5" />
        </Link>
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-textMuted" />
        </div>
        <input
          type="text"
          className="input pl-10"
          placeholder="Cari nama atau SKU..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            resetVisibleCount();
          }}
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(value => !value)}
          className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
        <div className="text-xs text-textMuted">
          {Math.min(visibleProducts.length, filteredProducts.length)} dari {filteredProducts.length} produk
        </div>
      </div>

      {filtersOpen && (
        <div className="card mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-primary">Filter Produk</h2>
            <button type="button" onClick={clearFilters} className="rounded-md p-2 text-textMuted hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select className="input" value={categoryFilter} onChange={e => {
                setCategoryFilter(e.target.value);
                resetVisibleCount();
              }}>
                <option value="">Semua</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <select className="input" value={brandFilter} onChange={e => {
                setBrandFilter(e.target.value);
                resetVisibleCount();
              }}>
                <option value="">Semua</option>
                {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier</label>
              <select className="input" value={supplierFilter} onChange={e => {
                setSupplierFilter(e.target.value);
                resetVisibleCount();
              }}>
                <option value="">Semua</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mode</label>
              <select className="input" value={pricingModeFilter} onChange={e => {
                setPricingModeFilter(e.target.value);
                resetVisibleCount();
              }}>
                <option value="">Semua</option>
                <option value="AUTO_MARGIN">Auto Margin</option>
                <option value="MANUAL_PRICE">Manual Price</option>
                <option value="LOCKED_PRICE">Locked Price</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="input" value={statusFilter} onChange={e => {
              setStatusFilter(e.target.value);
              resetVisibleCount();
            }}>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="all">Semua</option>
            </select>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {visibleProducts.map(p => {
          const prodUnits = units.filter(u => u.productId === p.id);
          const category = categories.find(c => c.id === p.categoryId);
          const baseUnit = prodUnits.find(u => u.conversionToBase === 1) || prodUnits[0];

          return (
            <Link key={p.id} to={`/products/${p.id}`} className="card flex items-center justify-between gap-3 py-3 transition-colors hover:border-primary">
              <div className="min-w-0 flex-1">
                <span className="block truncate font-bold text-textMain">{p.name}</span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs bg-gray-100 text-textMuted px-2 py-0.5 rounded font-mono">{p.sku}</span>
                    {category && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{category.name}</span>}
                    {!p.isActive && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Nonaktif</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {baseUnit && (
                  <>
                    <div className="font-bold text-primary">{formatCurrency(baseUnit.activeSellingPrice)}</div>
                    <div className="text-xs text-textMuted">{baseUnit.unitName}</div>
                  </>
                )}
                <span className={`mt-1 inline-block text-[10px] px-2 py-1 rounded font-bold ${
                    p.pricingMode === 'AUTO_MARGIN' ? 'bg-emerald-100 text-emerald-700' :
                    p.pricingMode === 'LOCKED_PRICE' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {p.pricingMode.replace('_', ' ')}
                  </span>
              </div>
            </Link>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center text-textMuted py-8">Tidak ada produk ditemukan</div>
        )}
        {visibleCount < filteredProducts.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
            className="btn-secondary w-full py-3"
          >
            Muat {Math.min(PAGE_SIZE, filteredProducts.length - visibleCount)} produk lagi
          </button>
        )}
      </div>
    </div>
  );
}
