"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Keyboard,
  Sparkles,
  RefreshCcw,
  Zap,
} from "lucide-react";

interface BatchProductItem {
  productId: string;
  sku: string;
  name: string;
  sentQty: number;
  price: number;
  scannedQty: number;
}

interface ScanEvent {
  id: string;
  sku: string;
  name: string;
  timestamp: string;
  isKnown: boolean;
}

interface BarcodeScannerProps {
  batchId: string;
  storeName: string;
  items: BatchProductItem[];
  onFinishReconciliation: (scannedMap: Map<string, number>, scanEvents: ScanEvent[]) => void;
  finishing: boolean;
}

export default function BarcodeScanner({
  batchId,
  storeName,
  items: initialItems,
  onFinishReconciliation,
  finishing,
}: BarcodeScannerProps) {
  const [items, setItems] = useState<BatchProductItem[]>(initialItems);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentScans, setRecentScans] = useState<ScanEvent[]>([]);
  const [unknownSkuWarning, setUnknownSkuWarning] = useState<string | null>(null);
  const [lastScannedSku, setLastScannedSku] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Focus input automatically for hardware scanners
  useEffect(() => {
    const focusInput = () => {
      if (!isCameraActive && inputRef.current) {
        inputRef.current.focus();
      }
    };
    focusInput();

    const handleWindowClick = () => {
      focusInput();
    };

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [isCameraActive]);

  // Audio tone feedback synthesizer
  const playBeep = (type: "success" | "warning") => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Warning double buzzer tone
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  // Process a scanned SKU
  const processSkuScan = (rawScannedCode: string) => {
    const code = rawScannedCode.trim();
    if (!code) return;

    const matchingItemIndex = items.findIndex(
      (item) => item.sku.toLowerCase() === code.toLowerCase()
    );

    if (matchingItemIndex !== -1) {
      // Valid Item in Batch
      const matched = items[matchingItemIndex];
      const updated = [...items];
      updated[matchingItemIndex] = {
        ...matched,
        scannedQty: matched.scannedQty + 1,
      };
      setItems(updated);
      setLastScannedSku(matched.sku);
      setUnknownSkuWarning(null);
      playBeep("success");

      const scanEvent: ScanEvent = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sku: matched.sku,
        name: matched.name,
        timestamp: new Date().toLocaleTimeString("ar-EG"),
        isKnown: true,
      };
      setRecentScans((prev) => [scanEvent, ...prev.slice(0, 49)]);
    } else {
      // Unknown SKU (NOT in this consignment batch)
      setUnknownSkuWarning(code);
      setLastScannedSku(null);
      playBeep("warning");

      const scanEvent: ScanEvent = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sku: code,
        name: "باركود غير معروف (ليس في هذه الإرسالية)",
        timestamp: new Date().toLocaleTimeString("ar-EG"),
        isKnown: false,
      };
      setRecentScans((prev) => [scanEvent, ...prev.slice(0, 49)]);
    }

    setBarcodeInput("");
  };

  // Hardware scanner key handler (submits on Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processSkuScan(barcodeInput);
    }
  };

  // HTML5 Camera Scanner Toggle
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          html5QrCodeRef.current.clear();
        } catch (err) {
          console.error("Error stopping camera scanner:", err);
        }
        html5QrCodeRef.current = null;
      }
      setIsCameraActive(false);
    } else {
      setIsCameraActive(true);
      setTimeout(async () => {
        try {
          const qrScanner = new Html5Qrcode("camera-scanner-viewport");
          html5QrCodeRef.current = qrScanner;

          await qrScanner.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: { width: 280, height: 200 },
              aspectRatio: 1.333,
            },
            (decodedText) => {
              processSkuScan(decodedText);
            },
            () => {
              // Frame parse progress
            }
          );
        } catch (err) {
          console.error("Camera scanner startup failed:", err);
          setIsCameraActive(false);
          alert("تعذر الوصول إلى الكاميرا. يرجى التحقق من أذونات الكاميرا أو استخدام قارئ الباركود اليدوي.");
        }
      }, 100);
    }
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Update item quantity directly via +/- buttons
  const handleQtyAdjust = (productId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const nextQty = Math.max(0, item.scannedQty + delta);
          return { ...item, scannedQty: nextQty };
        }
        return item;
      })
    );
  };

  const handleFinish = () => {
    const scannedMap = new Map<string, number>();
    items.forEach((item) => {
      scannedMap.set(item.productId, item.scannedQty);
    });
    onFinishReconciliation(scannedMap, recentScans);
  };

  const totalSent = items.reduce((acc, i) => acc + i.sentQty, 0);
  const totalScanned = items.reduce((acc, i) => acc + i.scannedQty, 0);
  const totalRemainingSold = items.reduce((acc, i) => acc + Math.max(0, i.sentQty - i.scannedQty), 0);

  return (
    <div className="space-y-6">
      {/* Scan Control Header Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-xl font-bold text-white tracking-tight">محطة جرد ومطابقة المخزون الميداني</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              المتجر: <span className="text-indigo-400 font-semibold">{storeName}</span> | رقم الشحنة:{" "}
              <span className="font-mono text-slate-300">{batchId}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "كتم صوت التنبيه" : "تفعيل صوت التنبيه"}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                soundEnabled
                  ? "border-indigo-500/40 bg-indigo-950/40 text-indigo-300"
                  : "border-slate-800 bg-slate-800 text-slate-500"
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-indigo-400" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? "الصوت مفعّل" : "الصوت مكتوم"}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-md transition ${
                isCameraActive
                  ? "border-rose-500/50 bg-rose-950/60 text-rose-300 hover:bg-rose-900/60"
                  : "border-indigo-500/40 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-900/70"
              }`}
            >
              {isCameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {isCameraActive ? "إغلاق الكاميرا" : "فتح كاميرا المسح"}
            </button>
          </div>
        </div>

        {/* Primary Hardware Barcode Text Input Field */}
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-indigo-400" />
              إدخال قارئ الباركود اللاسلكي / USB (تركيز تلقائي)
            </span>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Zap className="h-3 w-3" /> القارئ جاهز (اضغط Enter بعد الرمز)
            </span>
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="امسح بالباركود أو اكتب الرمز (SKU) ثم اضغط Enter..."
              dir="ltr"
              className="w-full rounded-xl border border-indigo-500/40 bg-slate-950 pr-4 pl-32 py-3.5 text-base text-white placeholder-slate-500 font-mono shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none text-left"
            />
            <button
              type="button"
              onClick={() => processSkuScan(barcodeInput)}
              className="absolute left-2 top-2 bottom-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 transition"
            >
              تسجيل المسح
            </button>
          </div>
        </div>

        {/* Camera Scanner Viewport */}
        {isCameraActive && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-500/40 bg-slate-950 p-4 animate-in fade-in">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-black">
              <div id="camera-scanner-viewport" className="w-full min-h-[260px]"></div>
              {/* Laser Line Overlay Animation */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-center items-center">
                <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_15px_#f43f5e] animate-laser"></div>
                <div className="border border-indigo-400/50 rounded-lg w-64 h-44 pointer-events-none"></div>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              وجّه الكاميرا نحو باركود المنتج داخل الإطار. المسح التلقائي قيد العمل.
            </p>
          </div>
        )}

        {/* Unknown SKU Inline Warning Banner */}
        {unknownSkuWarning && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-300 animate-in shake">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-rose-200">تم مسح باركود غير مدرج في الشحنة: &quot;{unknownSkuWarning}&quot;</div>
                <div className="text-xs text-rose-300/80">
                  هذا المنتج لا ينتمي لبنود هذه الإرسالية. تم تسجيل المحاولة في السجل الزمني ولكن لم تُحتسب في الكميات.
                </div>
              </div>
            </div>
            <button
              onClick={() => setUnknownSkuWarning(null)}
              className="rounded-lg bg-rose-900/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-800"
            >
              إغلاق التنبيه
            </button>
          </div>
        )}

        {/* Laser Pulse feedback indicator for valid scan */}
        {lastScannedSku && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>تم بنجاح تسجيل قطعة للمنتج: <span className="font-mono text-white">{lastScannedSku}</span></span>
          </div>
        )}
      </div>

      {/* Progress & Live Count Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Items Progress List (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">حالة المخزون الفعلي المتبقي في المحل</h3>
            <span className="text-xs text-slate-400 font-mono">
              إجمالي القطع الممسوحة (المتبقية): <strong className="text-indigo-400">{totalScanned}</strong> من {totalSent}
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const progressPct = Math.min(100, Math.round((item.scannedQty / item.sentQty) * 100));
              const isOverScanned = item.scannedQty > item.sentQty;
              const isAllAccounted = item.scannedQty === item.sentQty;
              const soldUnits = Math.max(0, item.sentQty - item.scannedQty);

              return (
                <div
                  key={item.productId}
                  className={`rounded-xl border p-4 transition backdrop-blur-md shadow-md ${
                    isOverScanned
                      ? "border-amber-500/50 bg-amber-950/20"
                      : isAllAccounted
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : "border-slate-800 bg-slate-900/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-indigo-300">{item.sku}</span>
                        {isOverScanned && (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                            مسح زائد عن المرسل (+{item.scannedQty - item.sentQty})
                          </span>
                        )}
                        {isAllAccounted && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            كل الـ {item.sentQty} متبقية (لم يُباع منها)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 font-medium mt-0.5">{item.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        سعر الحبة: ${Number(item.price).toFixed(2)} | المباع المفوتر للمتجر:{" "}
                        <strong className="text-white font-mono">{soldUnits} قطعة</strong> (${(soldUnits * item.price).toFixed(2)})
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className="text-left font-mono">
                        <div className="text-xl font-extrabold text-white">
                          {item.scannedQty} <span className="text-xs text-slate-400 font-normal">/ {item.sentQty}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 text-right">المتبقي بالمحل</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQtyAdjust(item.productId, -1)}
                          disabled={item.scannedQty <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 font-bold"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQtyAdjust(item.productId, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>نسبة المخزون المتبقي في المحل</span>
                      <span>{progressPct}% ({item.scannedQty} من أصل {item.sentQty})</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isOverScanned
                            ? "bg-amber-500"
                            : isAllAccounted
                            ? "bg-emerald-500"
                            : "bg-indigo-500"
                        }`}
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scan Log Feed & Finish Card (1 Column) */}
        <div className="space-y-6">
          {/* Summary & Finish Button Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              ملخص المطابقة الفورية
            </h3>

            <div className="mt-4 space-y-2.5 divide-y divide-slate-800 text-xs">
              <div className="flex justify-between py-1.5 text-slate-300">
                <span>القطع المرسلة بالأصل:</span>
                <span className="font-mono font-bold text-white">{totalSent}</span>
              </div>
              <div className="flex justify-between py-1.5 text-slate-300">
                <span>المخزون المتبقي بالمحل:</span>
                <span className="font-mono font-bold text-indigo-400">{totalScanned}</span>
              </div>
              <div className="flex justify-between py-1.5 text-slate-300">
                <span>القطع المباعة (المستحقة للفوترة):</span>
                <span className="font-mono font-bold text-emerald-400">{totalRemainingSold}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={finishing}
              onClick={handleFinish}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {finishing ? (
                <RefreshCcw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  إنهاء وتثبيت مطابقة المخزون
                </>
              )}
            </button>
          </div>

          {/* Live Scan Log Feed */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                سجل المسح المباشر اللحظي
              </h4>
              <span className="text-[11px] text-slate-500">{recentScans.length} حركة</span>
            </div>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {recentScans.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  النظام جاهز. امسح الباركود لرؤية الحركات اللحظية هنا.
                </div>
              ) : (
                recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className={`flex items-center justify-between rounded-lg p-2.5 text-xs transition ${
                      scan.isKnown
                        ? "bg-slate-950/70 border border-slate-800/80 text-slate-200"
                        : "bg-rose-950/30 border border-rose-500/30 text-rose-300"
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-indigo-300">{scan.sku}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{scan.name}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{scan.timestamp}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

