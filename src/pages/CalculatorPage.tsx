import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PriceCalculation } from '../db/db';
import { TaxCalculatorService, PpnMode, type TaxCalculationResult } from '../services/TaxCalculatorService';
import { PricingCalculatorService, type PricingResult } from '../services/PricingCalculatorService';
import { MarginRuleResolver } from '../services/MarginRuleResolver';
import { ApprovalService } from '../services/ApprovalService';
import { UnitCostAllocationService } from '../services/UnitCostAllocationService';
import { formatCurrency, formatNumber } from '../utils/format';

const toDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type CostInputMode = 'PER_UNIT' | 'TOTAL_RECEIVED';
const CUSTOM_RECEIVED_UNIT_ID = '__CUSTOM_RECEIVED_UNIT__';

export default function CalculatorPage() {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [costInputMode, setCostInputMode] = useState<CostInputMode>('PER_UNIT');
  const [receivedUnitId, setReceivedUnitId] = useState('');
  const [receivedQuantity, setReceivedQuantity] = useState('1');
  const [customReceivedUnitSize, setCustomReceivedUnitSize] = useState('');
  const [manualCost, setManualCost] = useState('');
  const [ppnMode, setPpnMode] = useState<PpnMode>(PpnMode.NO_PPN);
  const [ppnRateInput, setPpnRateInput] = useState('');
  const [marginOverride, setMarginOverride] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(toDateInput(new Date()));
  const [changeReason, setChangeReason] = useState('');
  const [lockedConfirmed, setLockedConfirmed] = useState(false);

  const loadedProducts = useLiveQuery(() => db.products.filter(product => product.isActive).toArray());
  const loadedUnits = useLiveQuery(
    () => selectedProductId ? db.productUnits.where('productId').equals(selectedProductId).toArray() : [],
    [selectedProductId],
  );
  const loadedMarginRules = useLiveQuery(() => db.marginRules.toArray());
  const appSettings = useLiveQuery(() => db.appSettings.toArray());

  const products = loadedProducts ?? [];
  const units = loadedUnits ?? [];
  const selectedProduct = products.find(product => product.id === selectedProductId);
  const selectedUnit = units.find(unit => unit.id === selectedUnitId);
  const selectedReceivedUnit = units.find(unit => unit.id === receivedUnitId);
  const isTotalReceivedMode = costInputMode === 'TOTAL_RECEIVED';
  const isCustomReceivedUnit = receivedUnitId === CUSTOM_RECEIVED_UNIT_ID;
  const pricingModePolicy = selectedProduct
    ? PricingCalculatorService.getPricingModePolicy(selectedProduct.pricingMode)
    : null;

  const settings = useMemo(() => new Map((appSettings ?? []).map(setting => [setting.key, setting.value])), [appSettings]);
  const defaultPpnRate = useMemo(() => {
    const value = Number(settings.get('defaultPpnRate') ?? '11');
    return Number.isFinite(value) && value >= 0 ? value : 11;
  }, [settings]);
  const ppnRate = Number(ppnRateInput || defaultPpnRate);

  const activeMarginRules = useMemo(() => {
    return (loadedMarginRules ?? []).map(rule => ({
      ...rule,
      id: rule.id || '',
      referenceId: rule.referenceId?.toString(),
    }));
  }, [loadedMarginRules]);

  const resolvedMargin = useMemo(() => {
    if (!selectedProduct || activeMarginRules.length === 0) return null;
    return MarginRuleResolver.resolveMargin(activeMarginRules, {
      productId: selectedProduct.id || '',
      categoryId: selectedProduct.categoryId?.toString(),
      brandId: selectedProduct.brandId?.toString(),
      supplierId: selectedProduct.supplierId?.toString(),
      atDate: effectiveDate || new Date(),
    });
  }, [activeMarginRules, effectiveDate, selectedProduct]);

  const marginInput = marginOverride || resolvedMargin?.marginPercent.toString() || '';
  const costValue = Number(manualCost);
  const receivedQuantityValue = Number(receivedQuantity);
  const customReceivedUnitSizeValue = Number(customReceivedUnitSize);
  const receivedUnitConversion = isCustomReceivedUnit && selectedUnit
    ? selectedUnit.conversionToBase * customReceivedUnitSizeValue
    : selectedReceivedUnit?.conversionToBase;
  const receivedUnitLabel = isCustomReceivedUnit ? 'barang datang' : selectedReceivedUnit?.unitName;
  const marginValue = Number(marginInput);

  const targetUnitQuantityPreview = useMemo(() => {
    if (!isTotalReceivedMode || !selectedUnit || !receivedUnitConversion || !receivedQuantity) return null;
    try {
      return UnitCostAllocationService.calculateTargetUnitQuantity(
        receivedQuantityValue,
        receivedUnitConversion,
        selectedUnit.conversionToBase,
      );
    } catch {
      return null;
    }
  }, [isTotalReceivedMode, receivedQuantity, receivedQuantityValue, receivedUnitConversion, selectedUnit]);

  const calculation = useMemo((): {
    taxResult: TaxCalculationResult | null;
    totalTaxResult: TaxCalculationResult | null;
    targetUnitQuantity: number | null;
    pricingResult: PricingResult | null;
    error: string | null;
  } => {
    if (!manualCost || !marginInput) {
      return { taxResult: null, totalTaxResult: null, targetUnitQuantity: null, pricingResult: null, error: null };
    }

    try {
      const totalTaxResult = TaxCalculatorService.calculate(costValue, ppnMode, ppnRate);
      let taxResult = totalTaxResult;
      let targetUnitQuantity: number | null = null;

      if (isTotalReceivedMode) {
        if (!selectedUnit) {
          throw new Error('Pilih satuan jual yang akan dihitung.');
        }
        if (isCustomReceivedUnit && (!customReceivedUnitSize || !Number.isFinite(customReceivedUnitSizeValue) || customReceivedUnitSizeValue <= 0)) {
          throw new Error('Isi per satuan datang harus lebih dari 0.');
        }
        if (!receivedUnitConversion) {
          throw new Error('Pilih satuan barang datang.');
        }

        const allocation = UnitCostAllocationService.allocateTaxResultToTargetUnit(
          totalTaxResult,
          receivedQuantityValue,
          receivedUnitConversion,
          selectedUnit.conversionToBase,
        );
        taxResult = allocation.taxResult;
        targetUnitQuantity = allocation.targetUnitQuantity;
      }

      const pricingResult = PricingCalculatorService.calculatePrice(taxResult.finalCost, marginValue, {
        minPrice: selectedUnit?.minSellingPrice,
        maxPrice: selectedUnit?.maxSellingPrice,
      });
      return {
        taxResult,
        totalTaxResult: isTotalReceivedMode ? totalTaxResult : null,
        targetUnitQuantity,
        pricingResult,
        error: null,
      };
    } catch (error) {
      return {
        taxResult: null,
        totalTaxResult: null,
        targetUnitQuantity: null,
        pricingResult: null,
        error: error instanceof Error ? error.message : 'Input kalkulasi tidak valid.',
      };
    }
  }, [
    costValue,
    customReceivedUnitSize,
    customReceivedUnitSizeValue,
    isTotalReceivedMode,
    isCustomReceivedUnit,
    manualCost,
    marginInput,
    marginValue,
    ppnMode,
    ppnRate,
    receivedQuantityValue,
    receivedUnitConversion,
    selectedUnit,
  ]);

  const { taxResult, totalTaxResult, targetUnitQuantity, pricingResult, error: calculationError } = calculation;

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedUnitId('');
    setReceivedUnitId('');
    setReceivedQuantity('1');
    setCustomReceivedUnitSize('');
    setManualCost('');
    setMarginOverride('');
    setLockedConfirmed(false);
  };

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setReceivedUnitId(unitId);
    setReceivedQuantity('1');
    setCustomReceivedUnitSize('');
    const unit = units.find(item => item.id === unitId);
    setManualCost(costInputMode === 'PER_UNIT' && unit?.manualCost ? unit.manualCost.toString() : '');
  };

  const handleCostInputModeChange = (mode: CostInputMode) => {
    setCostInputMode(mode);
    setReceivedUnitId(selectedUnitId);
    setReceivedQuantity('1');
    setCustomReceivedUnitSize('');

    const unit = units.find(item => item.id === selectedUnitId);
    setManualCost(mode === 'PER_UNIT' && unit?.manualCost ? unit.manualCost.toString() : '');
  };

  const getPriceWarningMessage = () => {
    if (!pricingResult?.priceWarning) return null;
    if (pricingResult.priceWarning === 'BELOW_MINIMUM') {
      return `Harga dibulatkan di bawah minimum ${formatCurrency(selectedUnit?.minSellingPrice ?? 0)}.`;
    }
    return `Harga dibulatkan di atas maksimum ${formatCurrency(selectedUnit?.maxSellingPrice ?? 0)}.`;
  };

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedUnitId('');
    setReceivedUnitId('');
    setReceivedQuantity('1');
    setCustomReceivedUnitSize('');
    setManualCost('');
    setMarginOverride('');
    setChangeReason('');
    setLockedConfirmed(false);
  };

  const handleSaveCalculation = async (status: PriceCalculation['status']) => {
    if (!selectedProductId || !selectedUnitId) {
      alert('Pilih produk dan satuan terlebih dahulu');
      return;
    }
    if (!taxResult || !pricingResult) {
      alert('Input tidak valid');
      return;
    }
    if (pricingModePolicy?.requiresConfirmation && !lockedConfirmed) {
      alert('Konfirmasi harga terkunci sebelum membuat draft perubahan harga.');
      return;
    }
    if (status === 'WAITING_APPROVAL') {
      const approvalError = ApprovalService.canSubmitForApproval({
        effectiveDate,
        recommendedPrice: pricingResult.recommendedPrice,
      });
      if (approvalError) {
        alert(approvalError);
        return;
      }
    }

    try {
      const now = Date.now();
      await db.priceCalculations.add({
        id: crypto.randomUUID(),
        productId: selectedProductId,
        productUnitId: selectedUnitId,
        inputCost: taxResult.inputCost,
        ppnMode: taxResult.ppnMode,
        ppnRate: taxResult.ppnRate,
        baseCost: taxResult.baseCost,
        ppnAmount: taxResult.ppnAmount,
        finalCost: taxResult.finalCost,
        marginPercent: pricingResult.marginPercent,
        calculatedPrice: pricingResult.recommendedPrice,
        roundedPrice: pricingResult.roundedPrice,
        recommendedPrice: pricingResult.recommendedPrice,
        estimatedProfit: pricingResult.estimatedProfit,
        actualMargin: pricingResult.actualMargin,
        minPrice: selectedUnit?.minSellingPrice,
        maxPrice: selectedUnit?.maxSellingPrice,
        status,
        effectiveDate: effectiveDate || undefined,
        changeReason: changeReason.trim() || undefined,
        createdBy: 'Admin Lokal',
        createdAt: now,
        updatedAt: now,
      });

      alert(`Berhasil menyimpan sebagai ${status.replace('_', ' ')}`);
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-primary">Kalkulator Harga</h1>

      <div className="space-y-4">
        <div className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Produk</label>
            <select className="input" value={selectedProductId} onChange={event => handleProductChange(event.target.value)}>
              <option value="">Pilih Produk...</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="rounded-lg border border-border bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-textMain">Mode pricing</span>
                <span className="rounded bg-white px-2 py-1 text-[11px] font-bold text-primary">
                  {selectedProduct.pricingMode.replace('_', ' ')}
                </span>
              </div>
              {pricingModePolicy && (
                <p className="mt-2 text-xs text-textMuted">{pricingModePolicy.message}</p>
              )}
            </div>
          )}

          {selectedProductId && (
            <div>
              <label className="block text-sm font-medium mb-1">Satuan Jual yang Dihitung</label>
              <select className="input" value={selectedUnitId} onChange={event => handleUnitChange(event.target.value)}>
                <option value="">Pilih satuan jual...</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                ))}
              </select>
            </div>
          )}

          {selectedUnit && (
            <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
              <div className="rounded-lg bg-gray-50 p-2">
                <div>Harga aktif</div>
                <div className="font-bold text-textMain">{formatCurrency(selectedUnit.activeSellingPrice)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div>Batas harga</div>
                <div className="font-bold text-textMain">
                  {selectedUnit.minSellingPrice ? formatCurrency(selectedUnit.minSellingPrice) : '-'} / {selectedUnit.maxSellingPrice ? formatCurrency(selectedUnit.maxSellingPrice) : '-'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Mode Input Modal</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCostInputModeChange('PER_UNIT')}
                className={`h-10 rounded-md border text-xs font-semibold transition-colors ${
                  costInputMode === 'PER_UNIT' ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-textMuted'
                }`}
              >
                Per Satuan
              </button>
              <button
                type="button"
                onClick={() => handleCostInputModeChange('TOTAL_RECEIVED')}
                className={`h-10 rounded-md border text-xs font-semibold transition-colors ${
                  costInputMode === 'TOTAL_RECEIVED' ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-textMuted'
                }`}
              >
                Total Datang
              </button>
            </div>
          </div>

          {isTotalReceivedMode && (
            <div className="space-y-3 rounded-lg border border-border bg-gray-50 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Satuan Datang</label>
                  <select className="input" value={receivedUnitId} onChange={event => setReceivedUnitId(event.target.value)}>
                    <option value="">Pilih satuan...</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                    ))}
                    <option value={CUSTOM_RECEIVED_UNIT_ID}>Input isi manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Jumlah Datang</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="any"
                    value={receivedQuantity}
                    onChange={event => setReceivedQuantity(event.target.value)}
                    placeholder="Contoh: 1"
                  />
                </div>
              </div>

              {isCustomReceivedUnit && selectedUnit && (
                <div>
                  <label className="block text-xs font-medium mb-1">Isi per Satuan Datang</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="any"
                    value={customReceivedUnitSize}
                    onChange={event => setCustomReceivedUnitSize(event.target.value)}
                    placeholder={`Contoh: 12 ${selectedUnit.unitName}`}
                  />
                </div>
              )}

              {targetUnitQuantityPreview !== null && selectedUnit && receivedUnitLabel && (
                <div className="rounded-md bg-white p-2 text-xs font-medium text-textMuted">
                  {formatNumber(receivedQuantityValue)} {receivedUnitLabel} = {formatNumber(targetUnitQuantityPreview)} {selectedUnit.unitName}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              {isTotalReceivedMode ? 'Harga Modal Total Barang Datang' : `Harga Modal per ${selectedUnit?.unitName || 'Satuan'}`}
            </label>
            <input
              type="number"
              className="input"
              value={manualCost}
              onChange={event => setManualCost(event.target.value)}
              placeholder={isTotalReceivedMode ? 'Contoh: 120000' : 'Contoh: 10000'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mode PPN</label>
            <select className="input" value={ppnMode} onChange={event => setPpnMode(event.target.value as PpnMode)}>
              <option value={PpnMode.NO_PPN}>Non PPN</option>
              <option value={PpnMode.PPN_INCLUDED}>Termasuk PPN (Included)</option>
              <option value={PpnMode.PPN_EXCLUDED}>Belum PPN (Excluded)</option>
            </select>
          </div>

          {ppnMode !== PpnMode.NO_PPN && (
            <div>
              <label className="block text-sm font-medium mb-1">Rate PPN (%)</label>
              <input
                type="number"
                className="input"
                value={ppnRateInput || defaultPpnRate.toString()}
                onChange={event => setPpnRateInput(event.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Margin (%) dari Harga Jual</label>
            <input
              type="number"
              className="input"
              value={marginInput}
              onChange={event => setMarginOverride(event.target.value)}
              placeholder="Contoh: 15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Berlaku</label>
            <input
              type="date"
              className="input"
              value={effectiveDate}
              onChange={event => setEffectiveDate(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Alasan Perubahan</label>
            <textarea
              className="input min-h-20 resize-none"
              value={changeReason}
              onChange={event => setChangeReason(event.target.value)}
              placeholder="Opsional"
            />
          </div>

          {pricingModePolicy?.requiresConfirmation && (
            <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-800">
              <input
                type="checkbox"
                checked={lockedConfirmed}
                onChange={event => setLockedConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>Saya paham produk ini terkunci dan perubahan harga perlu perhatian khusus.</span>
            </label>
          )}
        </div>

        {calculationError && (
          <div className="rounded-lg border border-danger/30 bg-red-50 p-3 text-sm font-medium text-danger">
            {calculationError}
          </div>
        )}

        {pricingResult && taxResult && (
          <div className="card bg-indigo-50 border-indigo-100">
            <h2 className="text-lg font-bold text-indigo-900 mb-2">Hasil Kalkulasi</h2>

            <div className="space-y-2 text-sm text-indigo-800">
              {isTotalReceivedMode && totalTaxResult && targetUnitQuantity && selectedUnit && (
                <div className="mb-3 pb-3 border-b border-indigo-200/60 space-y-2">
                  <div className="flex justify-between text-indigo-600">
                    <span>Total modal masuk:</span>
                    <span>{formatCurrency(totalTaxResult.inputCost)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-600">
                    <span>Total setelah PPN:</span>
                    <span>{formatCurrency(totalTaxResult.finalCost)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-600">
                    <span>Dibagi ke:</span>
                    <span>{formatNumber(targetUnitQuantity)} {selectedUnit.unitName}</span>
                  </div>
                </div>
              )}
              {taxResult.ppnMode !== PpnMode.NO_PPN && (
                <div className="mb-3 pb-3 border-b border-indigo-200/60 space-y-2">
                  <div className="flex justify-between text-indigo-600">
                    <span>Harga Input per {selectedUnit?.unitName || 'satuan'}:</span>
                    <span>{formatCurrency(taxResult.inputCost)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-600">
                    <span>DPP per {selectedUnit?.unitName || 'satuan'}:</span>
                    <span>{formatCurrency(taxResult.baseCost)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-600">
                    <span>PPN per {selectedUnit?.unitName || 'satuan'} ({taxResult.ppnRate}%):</span>
                    <span>+{formatCurrency(taxResult.ppnAmount)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Modal Final per {selectedUnit?.unitName || 'satuan'}:</span>
                <span>{formatCurrency(taxResult.finalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Harga Rekomendasi per {selectedUnit?.unitName || 'satuan'}:</span>
                <span className="font-medium">{formatCurrency(pricingResult.recommendedPrice)}</span>
              </div>
              <div className="flex justify-between py-2 border-y border-indigo-200 my-2">
                <span className="font-bold">Harga Jual per {selectedUnit?.unitName || 'satuan'}:</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(pricingResult.roundedPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimasi Profit:</span>
                <span className="font-medium text-emerald-600">{formatCurrency(pricingResult.estimatedProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Margin Aktual:</span>
                <span className="font-medium">{formatNumber(pricingResult.actualMargin)}%</span>
              </div>
              {getPriceWarningMessage() && (
                <div className="mt-3 rounded-lg border border-warning/40 bg-amber-50 p-3 font-medium text-amber-800">
                  {getPriceWarningMessage()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={() => handleSaveCalculation('DRAFT')} disabled={!pricingResult} className="btn-secondary flex-1">Simpan Draft</button>
          <button onClick={() => handleSaveCalculation('WAITING_APPROVAL')} disabled={!pricingResult} className="btn-primary flex-1">Ajukan Approval</button>
        </div>
      </div>
    </div>
  );
}
