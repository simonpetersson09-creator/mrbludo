import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useTranslation } from "@/lib/i18n";
import { parseMatchCode } from "@/lib/online/match-code";

// Port of Yatzy's QRScanner: native OS scanner inside the app, camera via html5-qrcode on the web.
export function QRScanner({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (code: string) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onScanRef.current = onScan; onCloseRef.current = onClose; }, [onScan, onClose]);
  const isNative = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CapacitorBarcodeScanner");

  useEffect(() => {
    if (!open || !isNative) return;
    let cancelled = false;
    setError(null); setScanning(true);
    void import("@capacitor/barcode-scanner").then(({ CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint }) =>
      CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.QR_CODE, scanInstructions: t("scanQR"), cameraDirection: 1 }),
    ).then((result) => {
      if (cancelled) return;
      const code = parseMatchCode(String(result?.ScanResult ?? ""));
      if (code) onScanRef.current(code);
      onCloseRef.current();
    }).catch((err: unknown) => {
      if (cancelled) return;
      const msg = (err as { message?: string })?.message ?? "";
      if (/cancel/i.test(msg)) { onCloseRef.current(); return; }
      setScanning(false);
      setError(/permission|denied/i.test(msg) ? t("errCameraBlocked") : t("genericError"));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isNative]);

  useEffect(() => {
    if (!open || isNative) return;
    let cancelled = false;
    let handled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    setError(null); setScanning(true);
    void import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeScannerState }) => {
      if (cancelled) return;
      const s = new Html5Qrcode("qr-reader", { verbose: false });
      scanner = s;
      const decoded = (text: string) => {
        if (handled) return;
        const code = parseMatchCode(text);
        if (!code) return;
        handled = true;
        const finish = () => { onScanRef.current(code); onCloseRef.current(); };
        let state: number | null = null;
        try { state = s.getState(); } catch { /* not started */ }
        if (state === Html5QrcodeScannerState.SCANNING) s.stop().then(finish).catch(finish); else finish();
      };
      return s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, decoded, () => {})
        .then(() => { if (cancelled || handled) s.stop().catch(() => {}); });
    }).catch((err: unknown) => {
      if (cancelled) return;
      setScanning(false);
      const name = (err as { name?: string })?.name ?? "";
      const msg = (err as { message?: string })?.message ?? String(err);
      if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(msg)) setError(t("errCameraBlocked"));
      else if (name === "NotFoundError" || /no camera|not found/i.test(msg)) setError(t("errCameraNotFound"));
      else if (name === "NotReadableError" || /in use|busy/i.test(msg)) setError(t("errCameraInUse"));
      else if (/secure|https/i.test(msg)) setError(t("errCameraInsecure"));
      else setError(t("genericError"));
    });
    return () => {
      cancelled = true;
      const s = scanner;
      if (!s) return;
      try { s.stop().then(() => s.clear()).catch(() => {}); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 text-foreground">
          <ScanLine className="h-5 w-5" />
          <span className="font-display font-bold">{t("scanQR")}</span>
        </div>
        <button onClick={onClose} aria-label={t("back")} className="rounded-xl bg-secondary p-2 transition-colors active:bg-secondary/70">
          <X className="h-5 w-5 text-foreground" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {!isNative && <div id="qr-reader" className="h-full w-full" />}
        {!isNative && !error && scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-56 w-56">
              <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-primary" />
              <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-primary" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary" />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
              <p className="font-medium text-destructive">{error}</p>
              <button onClick={onClose} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">{t("ok")}</button>
            </div>
          </div>
        )}
      </div>
      <div className="px-6 py-4 text-center" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <p className="text-sm text-muted-foreground">{t("scanQR")}</p>
      </div>
    </div>
  );
}
