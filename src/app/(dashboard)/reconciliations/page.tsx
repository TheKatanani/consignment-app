"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  CheckCircle2,
  Search,
  RefreshCw,
} from "lucide-react";

interface ReconciliationItem {
  id: string;
  createdAt: string;
  performedBy: string;
  batch: {
    id: string;
    store: { id: string; name: string };
    items: Array<{ sentQty: number }>;
  };
  scans: Array<{ id: string; scannedQty: number; productId: string }>;
  settlement: {
    id: string;
    totalValue: string | number;
    zohoInvoiceId: string | null;
    status: "PENDING" | "SENT_TO_ZOHO" | "CONFIRMED" | "FAILED";
  } | null;
}

export default function ReconciliationsHistoryPage() {
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchStore, setSearchStore] = useState("");

  useEffect(() => {
    fetchReconciliations();
  }, []);

  const fetchReconciliations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/batches");
      const data = await res.json();
      const batches = data.batches || [];

      // Extract all reconciliations across all batches
      const list: ReconciliationItem[] = [];
      batches.forEach((b: {
        id: string;
        store: { id: string; name: string };
        items: Array<{ sentQty: number }>;
        reconciliations: Array<{
          id: string;
          createdAt: string;
          performedBy: string;
          scans: Array<{ id: string; scannedQty: number; productId: string }>;
          settlement: {
            id: string;
            totalValue: string | number;
            zohoInvoiceId: string | null;
            status: "PENDING" | "SENT_TO_ZOHO" | "CONFIRMED" | "FAILED";
          } | null;
        }>;
      }) => {
        (b.reconciliations || []).forEach((r) => {
          list.push({
            id: r.id,
            createdAt: r.createdAt,
            performedBy: r.performedBy,
            batch: {
              id: b.id,
              store: b.store,
              items: b.items,
            },
            scans: r.scans || [],
            settlement: r.settlement,
          });
        });
      });

      // Sort by newest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReconciliations(list);
    } catch (err) {
      console.error("Failed to load reconciliations:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = reconciliations.filter((r) =>
    r.batch.store.name.toLowerCase().includes(searchStore.toLowerCase()) ||
    r.batch.id.toLowerCase().includes(searchStore.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <History className="h-7 w-7 text-indigo-400" />
            سجل عمليات المطابقة والجرد الميداني
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سجل تدقيق تاريخي ودائم لعمليات المسح الفعلي، والكميات المباعة، وفواتير التسوية المصدرة.
          </p>
        </div>

        <button
          onClick={fetchReconciliations}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 text-indigo-400" /> تحديث السجل
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <input
          type="text"
          value={searchStore}
          onChange={(e) => setSearchStore(e.target.value)}
          placeholder="تصفية السجل باسم المتجر أو رقم الشحنة..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">رقم المطابقة</th>
                <th className="px-6 py-3.5 font-semibold">المتجر / الشحنة</th>
                <th className="px-6 py-3.5 font-semibold">الممسوح / المرسل</th>
                <th className="px-6 py-3.5 font-semibold">مبلغ التسوية</th>
                <th className="px-6 py-3.5 font-semibold">فاتورة زوهو</th>
                <th className="px-6 py-3.5 font-semibold">تاريخ الجرد</th>
                <th className="px-6 py-3.5 font-semibold text-left">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    جاري تحميل سجلات المطابقة...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    لا يوجد سجل مطابقات مسجل حتى الآن. أكمل عملية جرد لأي إرسالية لتظهر هنا.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const totalScanned = r.scans.reduce((acc, s) => acc + s.scannedQty, 0);
                  const totalSent = r.batch.items.reduce((acc, i) => acc + i.sentQty, 0);
                  const settlementStatus = r.settlement?.status || "PENDING";
                  const totalValue = r.settlement?.totalValue ? Number(r.settlement.totalValue) : 0;

                  return (
                    <tr key={r.id} className="transition hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-400">
                        {r.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{r.batch.store.name}</div>
                        <div className="text-xs font-mono text-slate-400">{r.batch.id}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        <span className="text-white font-bold">{totalScanned}</span> من {totalSent} ممسوح
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-emerald-400">
                        ${totalValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {r.settlement?.zohoInvoiceId ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {r.settlement.zohoInvoiceId}
                          </span>
                        ) : settlementStatus === "FAILED" ? (
                          <span className="text-rose-400 text-xs font-semibold">فشلت المزامنة</span>
                        ) : (
                          <span className="text-amber-400 text-xs font-semibold">بانتظار التأكيد</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {new Date(r.createdAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <Link
                          href={`/batches/${r.batch.id}/settlement`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          عرض الفاتورة
                        </Link>
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

