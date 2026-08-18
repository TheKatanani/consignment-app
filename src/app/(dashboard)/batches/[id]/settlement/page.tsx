"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import confetti from "canvas-confetti";
import {
  FileCheck,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  ArrowRight,
  Printer,
} from "lucide-react";
import Link from "next/link";

interface SettlementBatchDetail {
  id: string;
  store: { id: string; name: string; zohoWarehouseId: string | null };
  status: "ACTIVE" | "RECONCILED";
  items: Array<{
    productId: string;
    sentQty: number;
    product: {
      id: string;
      sku: string;
      name: string;
      price: string | number;
      zohoItemId: string | null;
    };
  }>;
  reconciliations: Array<{
    id: string;
    createdAt: string;
    scans: Array<{ productId: string; scannedQty: number }>;
    settlement: {
      id: string;
      totalValue: string | number;
      zohoInvoiceId: string | null;
      status: "PENDING" | "SENT_TO_ZOHO" | "CONFIRMED" | "FAILED";
      createdAt: string;
    } | null;
  }>;
}

export default function SettlementPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<SettlementBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettlementData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("تعذر تحميل بيانات التسوية والفاتورة.");
      const data = await res.json();
      setBatch(data.batch);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل التسوية.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchSettlementData();
  }, [fetchSettlementData]);

  const handleConfirmZohoInvoice = async (settlementId: string) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/settlements/${settlementId}/confirm`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "فشل في إنشاء الفاتورة في Zoho Inventory.");
      }

      setSuccessMessage(data.message || "تمت مزامنة وإنشاء فاتورة التسوية في Zoho Inventory بنجاح!");

      // Fire confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore if not supported
      }

      // Refresh batch data
      await fetchSettlementData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ أثناء مزامنة الفاتورة مع Zoho.");
      // Refresh to get FAILED status if set
      await fetchSettlementData();
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryZohoInvoice = async (settlementId: string) => {
    setSyncing(true);
    setError(null);

    try {
      const res = await fetch(`/api/settlements/${settlementId}/retry`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "فشلت إعادة المحاولة لإنشاء الفاتورة في Zoho.");
      }

      setSuccessMessage("تمت إعادة المحاولة بنجاح وتم إنشاء فاتورة Zoho.");
      await fetchSettlementData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشلت إعادة المحاولة.");
      await fetchSettlementData();
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCcw className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">جاري حساب بنود التسوية وتجهيز الفاتورة...</p>
        </div>
      </div>
    );
  }

  if (!batch || !batch.reconciliations || batch.reconciliations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center max-w-xl mx-auto">
        <AlertCircle className="h-10 w-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white mt-3">لم يتم العثور على سجل مطابقة</h2>
        <p className="text-sm text-slate-400 mt-1">
          هذه الإرسالية لم يتم جردها بعد. يرجى مسح المخزون المتبقي أولاً.
        </p>
        <Link
          href={`/batches/${batchId}/reconcile`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          الانتقال إلى مطابقة المخزون
        </Link>
      </div>
    );
  }

  const latestReconciliation = batch.reconciliations[0];
  const settlement = latestReconciliation.settlement;

  // Aggregate scans
  const scannedMap = new Map<string, number>();
  latestReconciliation.scans.forEach((s) => {
    const cur = scannedMap.get(s.productId) || 0;
    scannedMap.set(s.productId, cur + s.scannedQty);
  });

  // Calculate line items
  let totalSoldUnits = 0;
  let totalCalculatedAmount = 0;

  const lines = batch.items.map((item) => {
    const scannedQty = scannedMap.get(item.productId) || 0;
    const soldQty = Math.max(0, item.sentQty - scannedQty);
    const unitPrice = Number(item.product.price);
    const lineTotal = soldQty * unitPrice;

    totalSoldUnits += soldQty;
    totalCalculatedAmount += lineTotal;

    return {
      sku: item.product.sku,
      name: item.product.name,
      sentQty: item.sentQty,
      scannedQty,
      soldQty,
      unitPrice,
      lineTotal,
    };
  });

  const settlementStatus = settlement?.status || "PENDING";
  const isConfirmed = settlementStatus === "CONFIRMED";
  const isFailed = settlementStatus === "FAILED";

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-400 mb-2 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" /> العودة إلى لوحة التحكم
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileCheck className="h-7 w-7 text-indigo-400" />
            مراجعة تسوية بضاعة الأمانة وإصدار الفاتورة
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            المتجر: <strong className="text-slate-200">{batch.store.name}</strong> | رقم الشحنة:{" "}
            <span className="font-mono text-indigo-300">{batch.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" /> طباعة الملخص والفاتورة
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-rose-200">خطأ في إنشاء فاتورة Zoho</div>
              <div className="text-xs text-rose-300/90">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Status Banner */}
      <div
        className={`rounded-2xl border p-6 backdrop-blur-xl shadow-xl ${
          isConfirmed
            ? "border-emerald-500/40 bg-emerald-950/20"
            : isFailed
            ? "border-rose-500/40 bg-rose-950/20"
            : "border-slate-800 bg-slate-900/70"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isConfirmed
                  ? "bg-emerald-500/20 text-emerald-400"
                  : isFailed
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-indigo-500/20 text-indigo-400"
              }`}
            >
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                حالة تسوية الفاتورة
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-lg font-bold ${
                    isConfirmed
                      ? "text-emerald-400"
                      : isFailed
                      ? "text-rose-400"
                      : "text-amber-400"
                  }`}
                >
                  {settlementStatus === "CONFIRMED"
                    ? "تم تأكيد التسوية وإنشاء الفاتورة في Zoho"
                    : settlementStatus === "FAILED"
                    ? "فشلت المزامنة مع Zoho (يرجى إعادة المحاولة)"
                    : "بانتظار التأكيد وإصدار الفاتورة"}
                </span>
              </div>
              {settlement?.zohoInvoiceId && (
                <div className="text-xs text-slate-300 mt-1 font-mono">
                  رقم مرجع فاتورة زوهو: <strong className="text-emerald-300">{settlement.zohoInvoiceId}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div>
            {settlement && settlementStatus === "PENDING" && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleConfirmZohoInvoice(settlement.id)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {syncing ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد وإنشاء فاتورة Zoho Inventory
              </button>
            )}

            {settlement && settlementStatus === "FAILED" && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleRetryZohoInvoice(settlement.id)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 transition"
              >
                {syncing ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                إعادة محاولة مزامنة الفاتورة مع Zoho
              </button>
            )}

            {isConfirmed && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/80 px-4 py-2 text-xs font-semibold text-emerald-300 border border-emerald-800/60 font-mono">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                المزامنة مكتملة ومؤكدة
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Computed Sold Breakdown Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-bold text-white">تفصيل بنود الفاتورة والتسوية</h2>
          <span className="text-xs text-slate-400 font-mono">
            {totalSoldUnits} إجمالي القطع المباعة للمحل
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">المنتج / الباركود</th>
                <th className="px-6 py-3.5 font-semibold text-center">المرسل</th>
                <th className="px-6 py-3.5 font-semibold text-center">المتبقي بالمحل</th>
                <th className="px-6 py-3.5 font-semibold text-center">المباع (المفوتر)</th>
                <th className="px-6 py-3.5 font-semibold text-left">سعر الحبة</th>
                <th className="px-6 py-3.5 font-semibold text-left">إجمالي البند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {lines.map((line) => (
                <tr key={line.sku} className="transition hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-indigo-300">{line.sku}</div>
                    <div className="text-xs text-slate-400">{line.name}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-400">{line.sentQty}</td>
                  <td className="px-6 py-4 text-center font-mono font-semibold text-slate-200">
                    {line.scannedQty}
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-emerald-400 bg-emerald-950/10">
                    {line.soldQty}
                  </td>
                  <td className="px-6 py-4 text-left font-mono text-slate-400">
                    ${line.unitPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-left font-mono font-bold text-white">
                    ${line.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-800 bg-slate-950/80 font-semibold text-white">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right text-xs uppercase tracking-wider text-slate-400">
                  إجمالي مبلغ الفاتورة المستحق:
                </td>
                <td className="px-6 py-4 text-center font-mono text-emerald-400 font-bold">
                  {totalSoldUnits} قطعة
                </td>
                <td></td>
                <td className="px-6 py-4 text-left font-mono text-xl text-emerald-400 font-extrabold">
                  ${totalCalculatedAmount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

