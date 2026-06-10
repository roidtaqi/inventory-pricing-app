import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useMemo, useState } from 'react';
import { formatCurrency, formatNumber } from '../utils/format';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HistoryPage() {
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const loadedHistory = useLiveQuery(() => 
    db.priceHistories.orderBy('createdAt').reverse().toArray()
  );

  const loadedProducts = useLiveQuery(() => db.products.toArray());
  const loadedUnits = useLiveQuery(() => db.productUnits.toArray());
  const loadedCategories = useLiveQuery(() => db.categories.toArray());
  const history = useMemo(() => loadedHistory ?? [], [loadedHistory]);
  const products = useMemo(() => loadedProducts ?? [], [loadedProducts]);
  const units = useMemo(() => loadedUnits ?? [], [loadedUnits]);
  const categories = useMemo(() => loadedCategories ?? [], [loadedCategories]);

  const productOptions = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter(product => product.categoryId?.toString() === categoryFilter);
  }, [categoryFilter, products]);

  const handleProductFilterChange = (productId: string) => {
    setProductFilter(productId);

    const selectedProduct = products.find(product => product.id === productId);
    if (selectedProduct?.categoryId != null) {
      setCategoryFilter(selectedProduct.categoryId.toString());
    } else if (productId) {
      setCategoryFilter('');
    }
  };

  const handleCategoryFilterChange = (categoryId: string) => {
    setCategoryFilter(categoryId);

    if (!categoryId) return;

    const selectedProduct = products.find(product => product.id === productFilter);
    if (selectedProduct && selectedProduct.categoryId?.toString() !== categoryId) {
      setProductFilter('');
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const product = products.find(p => p.id === item.productId);
      if (productFilter && item.productId !== productFilter) return false;
      if (categoryFilter && product?.categoryId?.toString() !== categoryFilter) return false;
      if (dateFilter && item.effectiveDate !== dateFilter) return false;
      return true;
    });
  }, [categoryFilter, dateFilter, history, productFilter, products]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/more" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Riwayat Harga</h1>
      </div>

      <div className="mx-auto max-w-md p-4">
        <div className="card mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Produk</label>
            <select className="input" value={productFilter} onChange={e => handleProductFilterChange(e.target.value)}>
              <option value="">Semua produk</option>
              {productOptions.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select
                className="input disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-textMuted"
                value={categoryFilter}
                onChange={e => handleCategoryFilterChange(e.target.value)}
                disabled={Boolean(productFilter)}
              >
                <option value="">Semua</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal</label>
              <input className="input" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredHistory.map(h => {
            const product = products.find(p => p.id === h.productId);
            const unit = units.find(u => u.id === h.productUnitId);
            const date = new Date(h.createdAt).toLocaleDateString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const effectiveDate = h.effectiveDate
              ? new Date(`${h.effectiveDate}T00:00:00`).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })
              : '-';

          return (
            <div key={h.id} className="card space-y-2 text-sm">
              <div className="flex justify-between items-start border-b border-border pb-2">
                <div>
                  <div className="font-bold text-textMain">{product?.name || 'Unknown Product'}</div>
                  <div className="text-textMuted">{unit?.unitName || 'Unknown Unit'}</div>
                </div>
                <div className="text-[10px] text-textMuted text-right">{date}</div>
              </div>
              
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-1">
                <div className="text-center bg-gray-50 p-2 rounded">
                  <div className="text-xs text-textMuted mb-1">Harga Lama</div>
                  <div className="font-medium line-through opacity-60">{formatCurrency(h.oldPrice)}</div>
                </div>
                <div className="text-gray-400">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div className="text-center bg-emerald-50 p-2 rounded">
                  <div className="text-xs text-textMuted mb-1">Harga Baru</div>
                  <div className="font-bold text-emerald-700">{formatCurrency(h.newPrice)}</div>
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-textMuted px-1">
                <span>{`Modal: ${formatCurrency(h.oldCost)} -> ${formatCurrency(h.newCost)}`}</span>
                <span>Margin: {formatNumber(h.newMargin)}%</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
                <div className="rounded-lg bg-gray-50 p-2">
                  <div>PPN Lama</div>
                  <div className="font-medium text-textMain">{(h.oldPpnMode ?? 'UNKNOWN').replace('_', ' ')} ({formatCurrency(h.oldPpnAmount ?? 0)})</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <div>PPN Baru</div>
                  <div className="font-medium text-textMain">{(h.newPpnMode ?? 'NO_PPN').replace('_', ' ')} ({formatCurrency(h.newPpnAmount ?? 0)})</div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-textMuted px-1">
                <span>Berlaku {effectiveDate}</span>
                <span>Approved by {h.approvedBy ?? '-'}</span>
              </div>
            </div>
          );
          })}

          {filteredHistory.length === 0 && (
            <div className="card text-center text-textMuted py-8">
              Belum ada riwayat perubahan harga
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
