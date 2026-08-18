"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  Scan,
  Store,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface BatchDetailData {
  id: string;
  store: { id: string; name: string; address: string | null; zohoWarehouseId: string | null };
  status: "ACTIVE" | "RECONCILED";
  zohoTransferId: string | null;
  createdAt: string;
  items: Array<{
    id: string;
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
    settlement: {
      id: string;
      totalValue: string | number;
      status: string;
      zohoInvoiceId: string | null;
    } | null;
  }>;
}

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("لم يتم العثور على الشحنة المطلوبة.");
      const data = await res.json();
      setBatch(data.batch);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل في تحميل بيانات الشحنة.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">جاري تحميل تفاصيل الشحنة والإرسالية...</p>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center max-w-xl mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-rose-200 mt-3">الشحنة غير موجودة</h2>
        <p className="text-sm text-rose-300/80 mt-1">{error}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowRight className="h-4 w-4" /> العودة إلى لوحة التحكم
        </Link>
      </div>
    );
  }

  const totalUnits = batch.items.reduce((acc, i) => acc + i.sentQty, 0);
  const totalValue = batch.items.reduce((acc, i) => acc + i.sentQty * Number(i.product.price), 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" /> العودة إلى لوحة التحكم
        </Link>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-bold ${
            batch.status === "ACTIVE"
              ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
              : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40"
          }`}
        >
          {batch.status === "ACTIVE" ? "إرسالية أمانة نشطة (قيد التوزيع)" : "تمت المطابقة والتسوية"}
        </span>
      </div>

      {/* Main Card Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="h-6 w-6 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                إرسالية رقم #{batch.id}
              </h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-slate-400" />
                المتجر: <strong className="text-white">{batch.store.name}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                تاريخ الإرسال: {new Date(batch.createdAt).toLocaleString("ar-EG")}
              </span>
            </div>
          </div>

          <div>
            {batch.status === "ACTIVE" ? (
              <Link
                href={`/batches/${batch.id}/reconcile`}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
              >
                <Scan className="h-4 w-4" />
                بدء مطابقة المخزون بالباركود
              </Link>
            ) : (
              <Link
                href={`/batches/${batch.id}/settlement`}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                <FileText className="h-4 w-4" />
                عرض فاتورة التسوية النهائية
              </Link>
            )}
          </div>
        </div>

        {/* Zoho Sync Card Details */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
          <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-2">
            بيانات ربط ومزامنة مستودع Zoho Inventory
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400">
            <div>
              مستودع الوجهة في زوهو:{" "}
              {batch.store.zohoWarehouseId ? (
                <strong className="text-emerald-400 font-mono">{batch.store.zohoWarehouseId}</strong>
              ) : (
                <span className="text-amber-400 font-semibold">غير مربوط (محفوظ محلياً)</span>
              )}
            </div>
            <div>
              رقم أمر التحويل في زوهو (Transfer Order):{" "}
              {batch.zohoTransferId ? (
                <span className="text-emerald-400 font-mono font-semibold">{batch.zohoTransferId}</span>
              ) : (
                <span className="text-slate-500">لا يوجد</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispatched Products List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-bold text-white">البنود المرسلة في الشحنة ({batch.items.length})</h2>
          <span className="text-xs text-slate-400 font-mono">
            {totalUnits} إجمالي القطع | ${totalValue.toFixed(2)} القيمة الإجمالية المرسلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">باركود المنتج (SKU)</th>
                <th className="px-6 py-3.5 font-semibold">اسم ووصف المنتج</th>
                <th className="px-6 py-3.5 font-semibold text-center">الكمية المرسلة</th>
                <th className="px-6 py-3.5 font-semibold text-left">سعر الحبة</th>
                <th className="px-6 py-3.5 font-semibold text-left">إجمالي البند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {batch.items.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-300">{item.product.sku}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-200">{item.product.name}</td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-white">{item.sentQty}</td>
                  <td className="px-6 py-4 text-left font-mono text-slate-400">
                    ${Number(item.product.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-left font-mono font-semibold text-emerald-400">
                    ${(item.sentQty * Number(item.product.price)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

