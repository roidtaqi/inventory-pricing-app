import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PriceCalculation } from '../db/db';
import { useEffect } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import { ApprovalService } from '../services/ApprovalService';
import { formatCurrency, formatNumber } from '../utils/format';

export default function ApprovalPage() {
  const pendingCalculations = useLiveQuery(() => 
    db.priceCalculations.where('status').equals('WAITING_APPROVAL').toArray()
  ) || [];
  const scheduledCalculations = useLiveQuery(() =>
    db.priceCalculations.where('status').equals('SCHEDULED').toArray()
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.toArray()) || [];

  useEffect(() => {
    ApprovalService.activateDueScheduledPrices().catch(console.error);
  }, []);

  const handleApprove = async (calc: PriceCalculation) => {
    try {
      const status = await ApprovalService.approveCalculation(calc.id!);
      alert(status === 'ACTIVE' ? 'Harga disetujui dan diaktifkan.' : 'Harga disetujui dan dijadwalkan.');
    } catch (e) {
      console.error(e);
      alert('Gagal menyetujui harga');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const reason = window.prompt('Alasan penolakan (opsional)') ?? undefined;
      await ApprovalService.rejectCalculation(id, 'Owner Lokal', reason);
    } catch (e) {
      console.error(e);
      alert('Gagal menolak harga');
    }
  };

  const renderCalculationCard = (calc: PriceCalculation, isScheduled = false) => {
    const product = products.find(p => p.id === calc.productId);
    const unit = units.find(u => u.id === calc.productUnitId);
    const effectiveDate = calc.effectiveDate
      ? new Date(`${calc.effectiveDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';

    return (
      <div key={calc.id} className="card space-y-3">
        <div className="flex justify-between items-start border-b border-border pb-2">
          <div>
            <div className="font-bold text-textMain">{product?.name || 'Unknown Product'}</div>
            <div className="text-sm text-textMuted">{unit?.unitName || 'Unknown Unit'}</div>
          </div>
          <div className={isScheduled ? 'bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold' : 'bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded font-bold'}>
            {isScheduled ? 'Scheduled' : 'Menunggu'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-textMuted mb-1">Harga Aktif</div>
            <div className="font-medium line-through opacity-70">{formatCurrency(unit?.activeSellingPrice || 0)}</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Harga Baru</div>
            <div className="font-bold text-emerald-600">{formatCurrency(calc.roundedPrice)}</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Modal Lama</div>
            <div className="font-medium">{formatCurrency(unit?.manualCost || 0)}</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Modal Baru</div>
            <div className="font-medium">{formatCurrency(calc.finalCost)}</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">PPN</div>
            <div className="font-medium">{calc.ppnMode.replace('_', ' ')} ({formatCurrency(calc.ppnAmount)})</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Margin Aktual</div>
            <div className="font-medium">{formatNumber(calc.actualMargin)}%</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Profit Estimasi</div>
            <div className="font-medium text-emerald-600">{formatCurrency(calc.estimatedProfit)}</div>
          </div>
          <div>
            <div className="text-textMuted mb-1">Berlaku</div>
            <div className="font-medium">{effectiveDate}</div>
          </div>
        </div>

        {calc.changeReason && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-textMuted">
            {calc.changeReason}
          </div>
        )}

        <div className="flex justify-between text-xs text-textMuted">
          <span>Dibuat oleh {calc.createdBy ?? 'Admin Lokal'}</span>
          <span>Margin rule {calc.marginPercent}%</span>
        </div>

        {!isScheduled && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <button onClick={() => handleReject(calc.id!)} className="flex-1 flex justify-center items-center gap-1 py-2 rounded border border-danger text-danger hover:bg-red-50 transition font-medium">
              <X className="w-4 h-4" /> Tolak
            </button>
            <button onClick={() => handleApprove(calc)} className="flex-1 flex justify-center items-center gap-1 py-2 rounded bg-primary text-white hover:bg-indigo-700 transition font-medium">
              <Check className="w-4 h-4" /> Setujui
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-primary">Approval Harga</h1>
      
      <div className="space-y-4">
        {pendingCalculations.map(calc => renderCalculationCard(calc))}
        
        {pendingCalculations.length === 0 && scheduledCalculations.length === 0 && (
          <div className="card text-center text-textMuted py-8">
            Belum ada harga yang menunggu approval
          </div>
        )}

        {scheduledCalculations.length > 0 && (
          <div className="pt-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-textMain">
              <CalendarClock className="h-4 w-4 text-primary" />
              Harga Terjadwal
            </div>
            <div className="space-y-4">
              {scheduledCalculations.map(calc => renderCalculationCard(calc, true))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
