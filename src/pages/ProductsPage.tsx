import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [pricingModeFilter, setPricingModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  
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
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Kategori</label>
            <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">Semua</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <select className="input" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">Semua</option>
              {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier</label>
            <select className="input" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
              <option value="">Semua</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode</label>
            <select className="input" value={pricingModeFilter} onChange={e => setPricingModeFilter(e.target.value)}>
              <option value="">Semua</option>
              <option value="AUTO_MARGIN">Auto Margin</option>
              <option value="MANUAL_PRICE">Manual Price</option>
              <option value="LOCKED_PRICE">Locked Price</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="all">Semua</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-3">
        {filteredProducts.map(p => {
          const prodUnits = units.filter(u => u.productId === p.id);
          const category = categories.find(c => c.id === p.categoryId);
          const baseUnit = prodUnits.find(u => u.conversionToBase === 1) || prodUnits[0];

          return (
            <Link key={p.id} to={`/products/${p.id}`} className="card flex flex-col gap-2 hover:border-primary transition-colors block">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold block text-textMain">{p.name}</span>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-xs bg-gray-100 text-textMuted px-2 py-0.5 rounded font-mono">{p.sku}</span>
                    {category && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{category.name}</span>}
                    {!p.isActive && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Nonaktif</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                  p.pricingMode === 'AUTO_MARGIN' ? 'bg-emerald-100 text-emerald-700' :
                  p.pricingMode === 'LOCKED_PRICE' ? 'bg-red-100 text-red-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {p.pricingMode.replace('_', ' ')}
                </span>
              </div>
              
              {baseUnit && (
                <div className="flex justify-between items-end mt-2 pt-2 border-t border-border/50">
                  <div className="text-xs text-textMuted">Harga Aktif ({baseUnit.unitName})</div>
                  <div className="font-bold text-primary">{formatCurrency(baseUnit.activeSellingPrice)}</div>
                </div>
              )}
            </Link>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center text-textMuted py-8">Tidak ada produk ditemukan</div>
        )}
      </div>
    </div>
  );
}
