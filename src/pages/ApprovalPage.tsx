import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PriceCalculation } from '../db/db';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, ShieldCheck, X } from 'lucide-react';
import { ApprovalService } from '../services/ApprovalService';
import { SessionService } from '../services/SessionService';
import { formatCurrency, formatNumber } from '../utils/format';
import { useAppAlert } from '../components/AppAlertContext';

export default function ApprovalPage() {
  const { showAlert } = useAppAlert();
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'SCHEDULED' | 'HISTORY'>('PENDING');

  const pendingCalculations = useLiveQuery(() => 
    db.priceCalculations.where('status').equals('WAITING_APPROVAL').toArray()
  ) || [];
  const scheduledCalculations = useLiveQuery(() =>
    db.priceCalculations.where('status').equals('SCHEDULED').toArray()
  ) || [];
  const approvalHistory = useLiveQuery(async () => {
    const calculations = await db.priceCalculations.toArray();
    return calculations
      .filter(calc => ['ACTIVE', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(calc.status))
      .sort((a, b) => (b.updatedAt ?? b.approvedAt ?? b.rejectedAt ?? b.createdAt) - (a.updatedAt ?? a.approvedAt ?? a.rejectedAt ?? a.createdAt));
  }) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.toArray()) || [];
  const appSettings = useLiveQuery(() => db.appSettings.toArray());
  const session = useMemo(() => SessionService.fromSettings(appSettings), [appSettings]);
  const canCurrentUserApprove = SessionService.canApprove(session.role);
  const roleLabel = SessionService.roleLabel(session.role);

  useEffect(() => {
    ApprovalService.activateDueScheduledPrices().catch(console.error);
  }, []);

  const handleApprove = async (calc: PriceCalculation) => {
    if (!canCurrentUserApprove) {
      showAlert({ tone: 'warning', title: 'Akses Ditolak', message: 'Hanya Owner yang bisa menyetujui harga.' });
      return;
    }

    try {
      const status = await ApprovalService.approveCalculation(calc.id!, session.name, new Date(), session.role);
      showAlert({
        tone: 'success',
        title: 'Approval Berhasil',
        message: status === 'ACTIVE' ? 'Harga disetujui dan diaktifkan.' : 'Harga disetujui dan dijadwalkan.',
      });
    } catch (e) {
      console.error(e);
      showAlert({ tone: 'error', title: 'Gagal Approval', message: 'Harga belum berhasil disetujui. Coba ulangi lagi.' });
    }
  };

  const handleReject = async (id: string) => {
    if (!canCurrentUserApprove) {
      showAlert({ tone: 'warning', title: 'Akses Ditolak', message: 'Hanya Owner yang bisa menolak harga.' });
      return;
    }

    setRejectTargetId(id);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setRejectTargetId(null);
    setRejectionReason('');
  };

  const submitReject = async () => {
    if (!rejectTargetId) return;

    try {
      await ApprovalService.rejectCalculation(rejectTargetId, session.name, rejectionReason.trim() || undefined, session.role);
      closeRejectModal();
      showAlert({ tone: 'success', title: 'Harga Ditolak', message: 'Draft perubahan harga berhasil ditolak.' });
    } catch (e) {
      console.error(e);
      showAlert({ tone: 'error', title: 'Gagal Menolak', message: 'Draft perubahan harga belum berhasil ditolak. Coba ulangi lagi.' });
    }
  };

  const getStatusLabel = (calc: PriceCalculation, isScheduled = false) => {
    if (isScheduled) return 'Terjadwal';
    if (calc.status === 'WAITING_APPROVAL') return 'Menunggu';
    if (calc.status === 'ACTIVE') return 'Disetujui';
    if (calc.status === 'APPROVED') return 'Disetujui';
    if (calc.status === 'REJECTED') return 'Ditolak';
    if (calc.status === 'EXPIRED') return 'Expired';
    return calc.status.replace('_', ' ');
  };

  const getStatusClassName = (calc: PriceCalculation, isScheduled = false) => {
    if (isScheduled || calc.status === 'SCHEDULED') return 'bg-blue-100 text-blue-700';
    if (calc.status === 'WAITING_APPROVAL') return 'bg-amber-100 text-amber-700';
    if (calc.status === 'REJECTED') return 'bg-red-100 text-red-700';
    if (calc.status === 'EXPIRED') return 'bg-gray-100 text-gray-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const formatTimestamp = (value?: number) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderCalculationCard = (calc: PriceCalculation, isScheduled = false) => {
    const product = products.find(p => p.id === calc.productId);
    const unit = units.find(u => u.id === calc.productUnitId);
    const effectiveDate = calc.effectiveDate
      ? new Date(`${calc.effectiveDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';
    const showApprovalActions = canCurrentUserApprove && calc.status === 'WAITING_APPROVAL' && !isScheduled;

    return (
      <div key={calc.id} className="card space-y-3">
        <div className="flex justify-between items-start border-b border-border pb-2">
          <div>
            <div className="font-bold text-textMain">{product?.name || 'Unknown Product'}</div>
            <div className="text-sm text-textMuted">{unit?.unitName || 'Unknown Unit'}</div>
          </div>
          <div className={`${getStatusClassName(calc, isScheduled)} text-xs px-2 py-1 rounded font-bold`}>
            {getStatusLabel(calc, isScheduled)}
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

        {calc.status === 'REJECTED' && calc.rejectionReason && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {calc.rejectionReason}
          </div>
        )}

        <div className="flex justify-between text-xs text-textMuted">
          <span>Dibuat oleh {calc.createdBy ?? 'Admin Lokal'}</span>
          <span>Margin rule {calc.marginPercent}%</span>
        </div>

        {calc.status !== 'WAITING_APPROVAL' && (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs text-textMuted">
            <div>
              <span className="block font-semibold text-textMain">Approved by</span>
              <span>{calc.approvedBy ?? '-'}</span>
            </div>
            <div>
              <span className="block font-semibold text-textMain">Approved at</span>
              <span>{formatTimestamp(calc.approvedAt)}</span>
            </div>
            {calc.status === 'REJECTED' && (
              <>
                <div>
                  <span className="block font-semibold text-textMain">Rejected by</span>
                  <span>{calc.rejectedBy ?? '-'}</span>
                </div>
                <div>
                  <span className="block font-semibold text-textMain">Rejected at</span>
                  <span>{formatTimestamp(calc.rejectedAt)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {!showApprovalActions && calc.status === 'WAITING_APPROVAL' && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-textMuted">
            Mode {roleLabel}: status bisa dilihat, approval hanya untuk Owner.
          </div>
        )}

        {showApprovalActions && (
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
    <>
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-primary">Approval Harga</h1>

        <div className={`mb-4 rounded-lg border p-3 text-sm ${canCurrentUserApprove ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-4 w-4" />
            Mode {roleLabel}: {session.name}
          </div>
          <div className="mt-1 text-xs leading-5">
            {canCurrentUserApprove ? 'Owner bisa menyetujui dan menolak perubahan harga.' : 'Admin dan kasir hanya bisa melihat status approval.'}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 rounded-lg border border-border bg-surface p-1 text-xs font-bold">
          {[
            { id: 'PENDING', label: 'Menunggu', count: pendingCalculations.length },
            { id: 'SCHEDULED', label: 'Terjadwal', count: scheduledCalculations.length },
            { id: 'HISTORY', label: 'Riwayat', count: approvalHistory.length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`rounded-md px-2 py-2 transition-colors ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-primary'}`}
            >
              {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
            </button>
          ))}
        </div>
        
        <div className="space-y-4">
          {activeTab === 'PENDING' && pendingCalculations.map(calc => renderCalculationCard(calc))}

          {activeTab === 'PENDING' && pendingCalculations.length === 0 && (
            <div className="card text-center text-textMuted py-8">
              Belum ada harga yang menunggu approval
            </div>
          )}

          {activeTab === 'SCHEDULED' && (
            <div>
              {scheduledCalculations.length > 0 && (
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-textMain">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Harga Terjadwal
                </div>
              )}
              <div className="space-y-4">
                {scheduledCalculations.map(calc => renderCalculationCard(calc, true))}
              </div>
              {scheduledCalculations.length === 0 && (
                <div className="card text-center text-textMuted py-8">
                  Belum ada harga terjadwal
                </div>
              )}
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              {approvalHistory.map(calc => renderCalculationCard(calc))}
              {approvalHistory.length === 0 && (
                <div className="card text-center text-textMuted py-8">
                  Belum ada riwayat approval
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {rejectTargetId && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-xl">
            <h2 className="text-lg font-bold text-textMain">Tolak Harga</h2>
            <label className="mt-3 block text-sm font-medium text-textMain">
              Alasan Penolakan
              <textarea
                className="input mt-1 min-h-24 resize-none"
                value={rejectionReason}
                onChange={event => setRejectionReason(event.target.value)}
                placeholder="Opsional"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={closeRejectModal} className="btn-secondary py-2">
                Batal
              </button>
              <button type="button" onClick={submitReject} className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white">
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
