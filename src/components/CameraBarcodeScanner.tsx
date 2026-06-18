import { useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatOneDReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, X } from 'lucide-react';

interface CameraBarcodeScannerProps {
  onClose: () => void;
  onDetected: (barcode: string) => Promise<boolean>;
}

function getPreferredCameraId(devices: MediaDeviceInfo[]) {
  const backCamera = devices.find(device => /back|rear|environment|belakang/i.test(device.label));
  return backCamera?.deviceId || devices[0]?.deviceId || '';
}

export function CameraBarcodeScanner({ onClose, onDetected }: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef({ text: '', at: 0 });
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [scannerError, setScannerError] = useState('');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const oneDReader = new BrowserMultiFormatOneDReader();
    const fallbackReader = new BrowserMultiFormatReader();

    async function startScanner() {
      try {
        setScannerError('');
        controlsRef.current?.stop();
        controlsRef.current = null;

        let videoInputDevices: MediaDeviceInfo[] = [];
        try {
          videoInputDevices = await BrowserCodeReader.listVideoInputDevices();
        } catch {
          videoInputDevices = [];
        }
        if (cancelled) return;

        setDevices(videoInputDevices);
        const deviceId = selectedDeviceId || getPreferredCameraId(videoInputDevices);
        const handleResult = (result: { getText: () => string } | undefined, scannerControls: IScannerControls) => {
          if (!result) return;

          const text = result.getText().trim();
          const now = Date.now();
          if (!text || (detectedRef.current.text === text && now - detectedRef.current.at < 1500)) return;

          detectedRef.current = { text, at: now };
          void onDetectedRef.current(text).then(success => {
            if (success) {
              scannerControls.stop();
              onCloseRef.current();
            }
          });
        };

        const decodeCallback = (result: { getText: () => string } | undefined, _error: unknown, scannerControls: IScannerControls) => {
          handleResult(result, scannerControls);
        };
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        let controls: IScannerControls;
        try {
          controls = deviceId
            ? await oneDReader.decodeFromVideoDevice(deviceId, videoRef.current || undefined, decodeCallback)
            : await oneDReader.decodeFromConstraints(constraints, videoRef.current || undefined, decodeCallback);
        } catch {
          controls = deviceId
            ? await fallbackReader.decodeFromVideoDevice(deviceId, videoRef.current || undefined, decodeCallback)
            : await fallbackReader.decodeFromConstraints(constraints, videoRef.current || undefined, decodeCallback);
        }

        if (!videoInputDevices.length) {
          void BrowserCodeReader.listVideoInputDevices()
            .then(nextDevices => {
              if (!cancelled) setDevices(nextDevices);
            })
            .catch(() => undefined);
        }

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setScannerError('Kamera tidak bisa dibuka. Pastikan izin kamera di browser sudah diizinkan.');
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [selectedDeviceId]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-textMain">Scan Barcode Produk</h3>
              <p className="text-xs text-textMuted">Kamera HP / webcam</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-textMuted hover:bg-gray-100 hover:text-textMain"
            title="Tutup scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-slate-950 p-3">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-5 top-1/2 h-20 -translate-y-1/2 rounded-md border-2 border-emerald-400/90 shadow-[0_0_0_999px_rgba(2,6,23,0.38)]" />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-300/90" />
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-textMuted">
            Arahkan kode batang secara horizontal di dalam kotak hijau. Pastikan garis barcode terlihat terang dan tajam.
          </p>

          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={event => setSelectedDeviceId(event.target.value)}
              className="input"
            >
              <option value="">Kamera otomatis</option>
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${index + 1}`}
                </option>
              ))}
            </select>
          )}

          {scannerError && (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-danger">
              {scannerError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
