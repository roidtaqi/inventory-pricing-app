import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus } from 'lucide-react';

export default function MarginPage() {
  const rules = useLiveQuery(() => db.marginRules.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const brands = useLiveQuery(() => db.brands.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const getReferenceName = (type: string, id?: string | number) => {
    if (!id) return '';
    const sid = id.toString();
    switch (type) {
      case 'CATEGORY': return categories.find(c => c.id?.toString() === sid)?.name || sid;
      case 'BRAND': return brands.find(b => b.id?.toString() === sid)?.name || sid;
      case 'SUPPLIER': return suppliers.find(s => s.id?.toString() === sid)?.name || sid;
      case 'PRODUCT': return products.find(p => p.id === sid)?.name || sid;
      default: return '';
    }
  };

  const formatRulePeriod = (from?: string, until?: string) => {
    if (!from && !until) return 'Berlaku tanpa batas tanggal';
    return `${from || 'Sekarang'} - ${until || 'Tanpa akhir'}`;
  };

  const activeRules = rules.filter(r => r.isActive);
  const inactiveRules = rules.filter(r => !r.isActive);

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-primary">Aturan Margin</h1>
        <Link to="/margin/new" className="bg-primary text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition">
          <Plus className="w-5 h-5" />
        </Link>
      </div>
      
      <div className="space-y-6">
        <div>
          <h2 className="font-bold text-textMain mb-2">Aturan Aktif</h2>
          <div className="space-y-3">
            {activeRules.sort((a,b) => a.priority - b.priority).map(r => (
              <Link to={`/margin/${r.id}`} key={r.id} className="card flex justify-between items-center block hover:border-primary transition">
                <div>
                  <div className="font-bold text-sm bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded inline-block mb-1">
                    {r.ruleType.replace('_', ' ')}
                  </div>
                  {r.ruleType !== 'STORE_DEFAULT' && (
                    <div className="text-sm font-medium text-textMain">{getReferenceName(r.ruleType, r.referenceId)}</div>
                  )}
                  <div className="text-xs text-textMuted mt-1">Priority: {r.priority}</div>
                  <div className="text-xs text-textMuted">{formatRulePeriod(r.effectiveFrom, r.effectiveUntil)}</div>
                </div>
                <div className="text-xl font-bold text-emerald-600">{r.marginPercent}%</div>
              </Link>
            ))}
            {activeRules.length === 0 && <div className="text-sm text-textMuted">Tidak ada aturan aktif</div>}
          </div>
        </div>

        {inactiveRules.length > 0 && (
          <div>
            <h2 className="font-bold text-textMain mb-2 opacity-60">Tidak Aktif</h2>
            <div className="space-y-3 opacity-60">
              {inactiveRules.map(r => (
                <Link to={`/margin/${r.id}`} key={r.id} className="card flex justify-between items-center block bg-gray-50 border-gray-200">
                  <div>
                    <div className="font-bold text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded inline-block mb-1">
                      {r.ruleType.replace('_', ' ')}
                    </div>
                    {r.ruleType !== 'STORE_DEFAULT' && (
                    <div className="text-sm font-medium text-textMain">{getReferenceName(r.ruleType, r.referenceId)}</div>
                  )}
                  <div className="text-xs text-textMuted">{formatRulePeriod(r.effectiveFrom, r.effectiveUntil)}</div>
                </div>
                <div className="text-lg font-bold text-gray-500">{r.marginPercent}%</div>
              </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
