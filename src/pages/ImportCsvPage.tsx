import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { db } from '../db/db';
import { CsvImportService, type CsvImportResult } from '../services/CsvImportService';

export default function ImportCsvPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState('');
  const batches = useLiveQuery(() => db.csvImportBatches.orderBy('createdAt').reverse().limit(10).toArray()) ?? [];
  const columns = CsvImportService.getProductCatalogColumns();

  const handleFileChange = async (file?: File) => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);
    setError('');

    try {
      const text = await file.text();
      const importResult = await CsvImportService.importProductCatalog(file.name, text);
      setResult(importResult);
    } catch (importError) {
      console.error(importError);
      setError(importError instanceof Error ? importError.message : 'Gagal import CSV');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/more" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Import CSV</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <label className="card flex cursor-pointer flex-col items-center justify-center gap-3 py-8 text-center transition-colors hover:border-primary">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-50 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-textMain">{isImporting ? 'Mengimpor...' : 'Pilih File CSV'}</div>
            <div className="mt-1 text-sm text-textMuted">Produk, satuan, supplier, dan modal</div>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isImporting}
            className="hidden"
            onChange={event => handleFileChange(event.target.files?.[0])}
          />
        </label>

        <div className="card space-y-3">
          <h2 className="font-bold text-primary">Kolom CSV</h2>
          <div className="flex flex-wrap gap-2">
            {columns.map(column => (
              <span key={column} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-textMuted">
                {column}
              </span>
            ))}
          </div>
        </div>

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle className="h-4 w-4" />
              Import selesai
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs">Total</div>
                <div className="font-bold">{result.totalRows}</div>
              </div>
              <div>
                <div className="text-xs">Valid</div>
                <div className="font-bold">{result.validRows}</div>
              </div>
              <div>
                <div className="text-xs">Invalid</div>
                <div className="font-bold">{result.invalidRows}</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-sm text-danger">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Import gagal
            </div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        <div className="card space-y-3">
          <h2 className="font-bold text-primary">Riwayat Import</h2>
          {batches.length === 0 && (
            <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-textMuted">Belum ada import</div>
          )}
          {batches.map(batch => (
            <div key={batch.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-textMain">{batch.fileName}</div>
                  <div className="mt-1 text-xs text-textMuted">
                    {new Date(batch.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-2 flex gap-2 text-xs text-textMuted">
                    <span>{batch.totalRows} baris</span>
                    <span>{batch.validRows} valid</span>
                    <span>{batch.invalidRows} invalid</span>
                  </div>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold text-textMuted">
                  {batch.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
