import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MarginRule } from '../db/db';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';

const PAGE_SIZE = 12;

type MarginTab = 'ALL' | MarginRule['ruleType'];

const tabs: Array<{ id: MarginTab; label: string }> = [
  { id: 'ALL', label: 'Semua' },
  { id: 'STORE_DEFAULT', label: 'Default' },
  { id: 'CATEGORY', label: 'Kategori' },
  { id: 'BRAND', label: 'Brand' },
  { id: 'SUPPLIER', label: 'Supplier' },
  { id: 'PRODUCT', label: 'Produk' },
];

const ruleLabels: Record<MarginRule['ruleType'], string> = {
  STORE_DEFAULT: 'Default',
  CATEGORY: 'Kategori',
  BRAND: 'Brand',
  SUPPLIER: 'Supplier',
  PRODUCT: 'Produk',
};

export default function MarginPage() {
  const [activeTab, setActiveTab] = useState<MarginTab>('ALL');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadedRules = useLiveQuery(() => db.marginRules.toArray());
  const loadedCategories = useLiveQuery(() => db.categories.toArray());
  const loadedBrands = useLiveQuery(() => db.brands.toArray());
  const loadedSuppliers = useLiveQuery(() => db.suppliers.toArray());
  const loadedProducts = useLiveQuery(() => db.products.toArray());

  const rules = useMemo(() => loadedRules ?? [], [loadedRules]);
  const categories = useMemo(() => loadedCategories ?? [], [loadedCategories]);
  const brands = useMemo(() => loadedBrands ?? [], [loadedBrands]);
  const suppliers = useMemo(() => loadedSuppliers ?? [], [loadedSuppliers]);
  const products = useMemo(() => loadedProducts ?? [], [loadedProducts]);

  const getReferenceName = useCallback((type: MarginRule['ruleType'], id?: string | number) => {
    if (type === 'STORE_DEFAULT') return 'Semua Produk';
    if (!id) return '-';
    const sid = id.toString();
    switch (type) {
      case 'CATEGORY': return categories.find(c => c.id?.toString() === sid)?.name || sid;
      case 'BRAND': return brands.find(b => b.id?.toString() === sid)?.name || sid;
      case 'SUPPLIER': return suppliers.find(s => s.id?.toString() === sid)?.name || sid;
      case 'PRODUCT': return products.find(p => p.id === sid)?.name || sid;
    }
  }, [brands, categories, products, suppliers]);

  const formatRulePeriod = (from?: string, until?: string) => {
    if (!from && !until) return 'Tanpa batas tanggal';
    return `${from || 'Sekarang'} - ${until || 'Tanpa akhir'}`;
  };

  const resetVisibleCount = () => setVisibleCount(PAGE_SIZE);

  const filteredRules = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rules
      .filter(rule => activeTab === 'ALL' || rule.ruleType === activeTab)
      .filter(rule => {
        if (statusFilter === 'active') return rule.isActive;
        if (statusFilter === 'inactive') return !rule.isActive;
        return true;
      })
      .filter(rule => {
        if (!keyword) return true;
        const referenceName = getReferenceName(rule.ruleType, rule.referenceId).toLowerCase();
        return ruleLabels[rule.ruleType].toLowerCase().includes(keyword) || referenceName.includes(keyword);
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.priority - b.priority || ruleLabels[a.ruleType].localeCompare(ruleLabels[b.ruleType]));
  }, [activeTab, getReferenceName, rules, search, statusFilter]);

  const visibleRules = filteredRules.slice(0, visibleCount);
  const activeRules = rules.filter(rule => rule.isActive);
  const defaultRule = activeRules.find(rule => rule.ruleType === 'STORE_DEFAULT');
  const activeFilterCount = [activeTab !== 'ALL' ? activeTab : '', statusFilter !== 'active' ? statusFilter : '', search.trim()].filter(Boolean).length;

  const clearFilters = () => {
    setActiveTab('ALL');
    setSearch('');
    setStatusFilter('active');
    setVisibleCount(PAGE_SIZE);
  };

  const ruleCounts = tabs.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.id] = tab.id === 'ALL'
      ? rules.length
      : rules.filter(rule => rule.ruleType === tab.id).length;
    return acc;
  }, {});

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Aturan Margin</h1>
          <div className="mt-1 text-xs text-textMuted">{activeRules.length} aturan aktif</div>
        </div>
        <Link to="/margin/new" className="bg-primary text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition">
          <Plus className="w-5 h-5" />
        </Link>
      </div>

      <div className="card mb-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-textMuted">Default</div>
          <div className="text-lg font-bold text-primary">{defaultRule ? `${defaultRule.marginPercent}%` : '-'}</div>
        </div>
        <div>
          <div className="text-xs text-textMuted">Aktif</div>
          <div className="text-lg font-bold text-emerald-600">{activeRules.length}</div>
        </div>
        <div>
          <div className="text-xs text-textMuted">Nonaktif</div>
          <div className="text-lg font-bold text-gray-500">{rules.length - activeRules.length}</div>
        </div>
      </div>

      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-textMuted" />
        </div>
        <input
          type="text"
          className="input pl-10"
          placeholder="Cari target margin..."
          value={search}
          onChange={event => {
            setSearch(event.target.value);
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
          {visibleRules.length} dari {filteredRules.length} aturan
        </div>
      </div>

      {filtersOpen && (
        <div className="card mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-primary">Filter Margin</h2>
            <button type="button" onClick={clearFilters} className="rounded-md p-2 text-textMuted hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="input" value={statusFilter} onChange={event => {
              setStatusFilter(event.target.value as 'active' | 'inactive' | 'all');
              resetVisibleCount();
            }}>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="all">Semua</option>
            </select>
          </div>
        </div>
      )}

      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                resetVisibleCount();
              }}
              className={clsx(
                'h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition-colors',
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'bg-surface text-textMuted border border-border hover:text-primary',
              )}
            >
              {tab.label} ({ruleCounts[tab.id] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visibleRules.map(rule => (
          <Link
            to={`/margin/${rule.id}`}
            key={rule.id}
            className={clsx(
              'card flex items-center justify-between gap-3 py-3 transition-colors hover:border-primary',
              !rule.isActive && 'bg-gray-50 opacity-70',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'rounded px-2 py-0.5 text-[10px] font-bold',
                  rule.isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-700',
                )}>
                  {ruleLabels[rule.ruleType]}
                </span>
                {!rule.isActive && <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">Nonaktif</span>}
              </div>
              <div className="mt-1 truncate text-sm font-bold text-textMain">{getReferenceName(rule.ruleType, rule.referenceId)}</div>
              <div className="mt-0.5 truncate text-xs text-textMuted">{formatRulePeriod(rule.effectiveFrom, rule.effectiveUntil)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className={clsx('text-xl font-bold', rule.isActive ? 'text-emerald-600' : 'text-gray-500')}>{rule.marginPercent}%</div>
              <div className="text-[10px] text-textMuted">P{rule.priority}</div>
            </div>
          </Link>
        ))}

        {filteredRules.length === 0 && (
          <div className="card py-8 text-center text-sm text-textMuted">
            Tidak ada aturan margin
          </div>
        )}

        {visibleCount < filteredRules.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
            className="btn-secondary w-full py-3"
          >
            Muat {Math.min(PAGE_SIZE, filteredRules.length - visibleCount)} aturan lagi
          </button>
        )}
      </div>
    </div>
  );
}
