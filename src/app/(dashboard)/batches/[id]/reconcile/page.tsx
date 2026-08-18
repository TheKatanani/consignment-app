"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { AlertCircle, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface BatchDetail {
  id: string;
  store: { id: string; name: string; zohoWarehouseId: string | null };
  status: "ACTIVE" | "RECONCILED";
  items: Array<{
    id: string;
    productId: string;
    sentQty: number;
    product: {
      id: string;
      sku: string;
      name: string;
      price: string | number;
    };
  }>;
}

interface AnomalyData {
  productId: string;
  sku: string;
  name: string;
  sentQty: number;
  scannedQty: number;
  excessQty: number;
}

export default function BatchReconcilePage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anomaly modal state
  const [anomalyModalOpen, setAnomalyModalOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  const [pendingScansPayload, setPendingScansPayload] = useState<unknown[]>([]);

  const fetchBatch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("فشل في تحميل بيانات إرسالية بضاعة الأمانة.");
      const data = await res.json();
      setBatch(data.batch);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل بيانات الشحنة.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  const handleFinishReconciliation = async (
    scannedMap: Map<string, number>
  ) => {
    if (!batch) return;
    setFinishing(true);
    setError(null);

    // Prepare scans payload
    const scansPayload = Array.from(scannedMap.entries())
      .filter(([, qty]) => qty > 0)
      .map(([productId, scannedQty]) => {
        const item = batch.items.find((i) => i.productId === productId);
        return {
          productId,
          sku: item?.product.sku || "UNKNOWN",
          scannedQty,
        };
      });

    try {
      const res = await fetch(`/api/batches/${batchId}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scans: scansPayload,
          overrideAnomalies: false,
        }),
      });

      const data = await res.json();

      if (res.status === 422 && data.requiresConfirmation) {
        // Anomaly detected: scannedQty > sentQty
        setAnomalies(data.anomalies || []);
        setPendingScansPayload(scansPayload);
        setAnomalyModalOpen(true);
        setFinishing(false);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل في إتمام عملية المطابقة.");
      }

      // Successful reconciliation -> go to settlement view
      router.push(`/batches/${batchId}/settlement`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل في حفظ نتائج المطابقة والجرد.");
      setFinishing(false);
    }
  };

  const handleConfirmAnomalyOverride = async () => {
    setFinishing(true);
    setAnomalyModalOpen(false);
    try {
      const res = await fetch(`/api/batches/${batchId}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scans: pendingScansPayload,
          overrideAnomalies: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل في إتمام المطابقة بعد تجاوز الفروقات.");
      }

      router.push(`/batches/${batchId}/settlement`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تأكيد تجاوز الفروقات.");
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">جاري تحميل واجهة مسح ومطابقة الباركود...</p>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center max-w-xl mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-rose-200 mt-3">الشحنة غير موجودة أو تعذر الوصول إليها</h2>
        <p className="text-sm text-rose-300/80 mt-1">{error || "إرسالية بضاعة الأمانة المطلوبة غير متوفرة."}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          <ArrowRight className="h-4 w-4" /> العودة إلى لوحة التحكم
        </Link>
      </div>
    );
  }

  const scannerItems = batch.items.map((i) => ({
    productId: i.productId,
    sku: i.product.sku,
    name: i.product.name,
    sentQty: i.sentQty,
    price: Number(i.product.price),
    scannedQty: 0,
  }));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between">
        <Link
          href={`/batches/${batch.id}`}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-indigo-400 transition"
        >
          <ArrowRight className="h-4 w-4" /> العودة لتفاصيل الشحنة
        </Link>
        <span className="rounded-md bg-indigo-950/80 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-800/40">
          وضع جرد وتدقيق بضاعة الأمانة
        </span>
      </div>

      {/* Main Barcode Scanner Station Component */}
      <BarcodeScanner
        batchId={batch.id}
        storeName={batch.store.name}
        items={scannerItems}
        onFinishReconciliation={handleFinishReconciliation}
        finishing={finishing}
      />

      {/* Anomaly Confirmation Modal */}
      {anomalyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تنبيه: وجود زيادة في الكميات الممسوحة</h3>
                <p className="text-xs text-amber-300">
                  عدد القطع الممسوحة في المحل يتجاوز الكمية المسجلة عند إرسال الشحنة.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 max-h-48 overflow-y-auto">
              {anomalies.map((a) => (
                <div key={a.productId} className="text-xs flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div>
                    <div className="font-mono font-bold text-amber-300">{a.sku}</div>
                    <div className="text-slate-400 text-[11px]">{a.name}</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-rose-400 font-bold">الممسوح: {a.scannedQty} (المرسل: {a.sentQty})</div>
                    <div className="text-amber-400 text-[10px]">+{a.excessQty} قطع فائضة</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              سيتم ضبط الكمية المباعة لهذه البنود على <strong>0</strong> (لن تكون سالبة إطلاقاً). هل ترغب في المتابعة وتثبيت فاتورة التسوية؟
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAnomalyModalOpen(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                إلغاء وإعادة الفحص
              </button>
              <button
                type="button"
                onClick={handleConfirmAnomalyOverride}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500"
              >
                تأكيد والمتابعة نحو الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

