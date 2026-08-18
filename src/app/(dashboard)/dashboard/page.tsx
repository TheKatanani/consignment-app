"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  DollarSign,
  AlertTriangle,
  Scan,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";

interface BatchSummary {
  id: string;
  store: { id: string; name: string; zohoWarehouseId: string | null };
  status: "ACTIVE" | "RECONCILED";
  items: Array<{ id: string; sentQty: number; product: { name: string; price: string | number } }>;
  createdAt: string;
  zohoTransferId: string | null;
}

interface OverdueStore {
  id: string;
  name: string;
  daysSinceLastReconcile: number | string;
  lastReconciliationDate: string | null;
  activeBatchesCount: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [overdueStores, setOverdueStores] = useState<OverdueStore[]>([]);
  const [unsettledTotal, setUnsettledTotal] = useState<number>(0);
  const [activeBatchesCount, setActiveBatchesCount] = useState<number>(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [batchesRes, storesRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/stores"),
      ]);

      const batchesData = await batchesRes.json();
      const storesData = await storesRes.json();

      const batchList: BatchSummary[] = batchesData.batches || [];
      setBatches(batchList);

      const activeList = batchList.filter((b) => b.status === "ACTIVE");
      setActiveBatchesCount(activeList.length);

      // Compute total potential consignment value out in the field (active batches)
      let totalOutValue = 0;
      activeList.forEach((b) => {
        b.items.forEach((item) => {
          totalOutValue += Number(item.product.price) * item.sentQty;
        });
      });
      setUnsettledTotal(totalOutValue);

      // Compute overdue stores (> 14 days without reconciliation)
      const now = new Date().getTime();
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      const overdue: OverdueStore[] = [];

      (storesData.stores || []).forEach((s: {
        id: string;
        name: string;
        batches: Array<{
          createdAt: string;
          status: string;
          reconciliations: Array<{ createdAt: string }>;
        }>;
      }) => {
        let lastDate: Date | null = null;
        s.batches.forEach((b) => {
          if (b.reconciliations && b.reconciliations.length > 0) {
            const reconDate = new Date(b.reconciliations[0].createdAt);
            if (!lastDate || reconDate > lastDate) {
              lastDate = reconDate;
            }
          }
        });

        const activeCount = s.batches.filter((b) => b.status === "ACTIVE").length;

        if (activeCount > 0) {
          if (!lastDate) {
            // Never reconciled
            overdue.push({
              id: s.id,
              name: s.name,
              daysSinceLastReconcile: "لم يتم الجرد مسبقاً",
              lastReconciliationDate: null,
              activeBatchesCount: activeCount,
            });
          } else {
            const diffMs = now - (lastDate as Date).getTime();
            if (diffMs > fourteenDaysMs) {
              const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
              overdue.push({
                id: s.id,
                name: s.name,
                daysSinceLastReconcile: `منذ ${days} يوماً`,
                lastReconciliationDate: (lastDate as Date).toISOString(),
                activeBatchesCount: activeCount,
              });
            }
          }
        }
      });

      setOverdueStores(overdue);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            لوحة العمليات والمتابعة الميدانية
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            متابعة فورية لإرساليات بضاعة الأمانة في المحلات، تدقيق المخزون، وحالة المزامنة مع Zoho.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/batches/new"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
          >
            <Boxes className="h-4 w-4" />
            إنشاء إرسالية بضاعة أمانة جديدة
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Active Batches */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              إرساليات الأمانة النشطة
            </span>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? "..." : activeBatchesCount}
            </span>
            <span className="text-xs text-slate-400">شحنة بانتظار الجرد والمطابقة</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-indigo-400">
            <Link href="/batches/new" className="flex items-center gap-1 hover:underline">
              إرسال شحنة جديدة <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Consignment Stock Value */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              قيمة البضاعة المعلقة في الميدان
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? "..." : `$${unsettledTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            <span className="text-xs text-slate-400">إجمالي غير مسوّى</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-emerald-400">
            <span>محسوبة من بنود الشحنات النشطة في المحلات</span>
          </div>
        </div>

        {/* Overdue Stores */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              متاجر متأخرة عن الجرد (&gt;14 يوم)
            </span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">
              {loading ? "..." : overdueStores.length}
            </span>
            <span className="text-xs text-slate-400">نقطة بيع بحاجة لزيارة ميدانية</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-amber-400">
            <span>لم يتم تسجيل مسح بالباركود منذ أكثر من أسبوعين</span>
          </div>
        </div>
      </div>

      {/* Overdue Stores Notice Banner if any */}
      {overdueStores.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
                تنبيه هام: متاجر متأخرة عن تدقيق وجرد بضاعة الأمانة
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                المتاجر التالية لديها بضاعة أمانة نشطة ولم يتم جرد مخزونها الفعلي منذ أكثر من 14 يوماً:
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueStores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/90 border border-amber-500/20 p-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{store.name}</div>
                  <div className="text-amber-400 font-mono text-[11px] mt-0.5">
                    آخر جرد: {store.daysSinceLastReconcile}
                  </div>
                </div>
                <Link
                  href={`/stores/${store.id}`}
                  className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30"
                >
                  عرض المتجر
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Batches Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Scan className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">إرساليات الأمانة الجارية</h2>
          </div>
          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
            {batches.filter((b) => b.status === "ACTIVE").length} إرسالية جاهزة للمطابقة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">رقم الشحنة (ID)</th>
                <th className="px-6 py-3.5 font-semibold">المتجر / نقطة البيع</th>
                <th className="px-6 py-3.5 font-semibold">المنتجات / الكمية</th>
                <th className="px-6 py-3.5 font-semibold">حالة مزامنة Zoho</th>
                <th className="px-6 py-3.5 font-semibold">تاريخ الإرسال</th>
                <th className="px-6 py-3.5 font-semibold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    جاري تحميل سجلات الإرساليات...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    لا توجد إرساليات بضاعة أمانة حتى الآن. اضغط على &quot;إنشاء إرسالية بضاعة أمانة جديدة&quot; للبدء.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const totalUnits = batch.items.reduce((acc, i) => acc + i.sentQty, 0);
                  const isLinkedToZoho = Boolean(batch.store.zohoWarehouseId);

                  return (
                    <tr key={batch.id} className="transition hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">
                        <Link href={`/batches/${batch.id}`} className="hover:underline">
                          {batch.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{batch.store.name}</div>
                        <div className="text-xs text-slate-400">
                          {isLinkedToZoho ? (
                            <span className="text-emerald-400 font-mono">مستودع زوهو: {batch.store.zohoWarehouseId}</span>
                          ) : (
                            <span className="text-amber-400">غير مربوط بمستودع زوهو</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{totalUnits} قطعة</div>
                        <div className="text-xs text-slate-400">{batch.items.length} منتجات مختلفة</div>
                      </td>
                      <td className="px-6 py-4">
                        {batch.zohoTransferId ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-950/80 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-800/40 font-mono">
                            <CheckCircle2 className="h-3 w-3" />
                            {batch.zohoTransferId}
                          </span>
                        ) : isLinkedToZoho ? (
                          <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-mono">
                            بانتظار المزامنة
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-950/60 px-2 py-0.5 text-xs text-amber-400 border border-amber-800/40">
                            محلي فقط
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {new Date(batch.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-6 py-4 text-left">
                        {batch.status === "ACTIVE" ? (
                          <Link
                            href={`/batches/${batch.id}/reconcile`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition"
                          >
                            <Scan className="h-3.5 w-3.5" />
                            مطابقة المخزون بالباركود
                          </Link>
                        ) : (
                          <Link
                            href={`/batches/${batch.id}/settlement`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                          >
                            عرض الفاتورة والتسوية
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

