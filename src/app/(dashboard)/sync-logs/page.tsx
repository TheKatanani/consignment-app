"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  Code,
} from "lucide-react";

interface SyncLog {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  status: "success" | "failed" | "skipped" | string;
  errorMessage: string | null;
  zohoResponse: unknown;
  createdAt: string;
}

export default function ZohoSyncLogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (operationFilter !== "all") params.append("operation", operationFilter);

      const res = await fetch(`/api/sync-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to load sync logs:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, operationFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileSpreadsheet className="h-7 w-7 text-indigo-400" />
            سجل تدقيق مزامنة عمليات Zoho Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سجل دائم غير قابل للتعديل لكافة عمليات الـ API مع زوهو (أوامر التحويل، الفواتير، مزامنة الكتالوج) مع حمولات الـ JSON.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 text-indigo-400" /> تحديث السجلات
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Filter className="h-4 w-4 text-indigo-400" /> تصفية السجلات:
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="all">كافة الحالات</option>
          <option value="success">العمليات الناجحة (Success)</option>
          <option value="failed">العمليات الفاشلة (Failed)</option>
          <option value="skipped">العمليات المتخطاة (Skipped)</option>
        </select>

        <select
          value={operationFilter}
          onChange={(e) => setOperationFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="all">كافة أنواع العمليات</option>
          <option value="transfer_order_create">أوامر التحويل (إرسال الشحنة)</option>
          <option value="invoice_create">فواتير المبيعات (التسوية)</option>
          <option value="catalog_sync">مزامنة كتالوج المنتجات</option>
          <option value="catalog_sync_batch">مزامنة الكتالوج المجمعة</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">التوقيت</th>
                <th className="px-6 py-3.5 font-semibold">نوع العملية</th>
                <th className="px-6 py-3.5 font-semibold">الكائن المعني</th>
                <th className="px-6 py-3.5 font-semibold">الحالة</th>
                <th className="px-6 py-3.5 font-semibold">التفاصيل / الخطأ</th>
                <th className="px-6 py-3.5 font-semibold text-left">بيانات الـ JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    جاري تحميل سجلات مزامنة زوهو...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    لا توجد سجلات مطابقة لمعايير التصفية.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-800/30">
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-300">
                      {log.operation}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="font-semibold text-white">{log.entityType}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                        {log.entityId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">
                          <CheckCircle2 className="h-3 w-3" /> ناجح
                        </span>
                      ) : log.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800/40">
                          <AlertCircle className="h-3 w-3" /> فشل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/40">
                          <AlertTriangle className="h-3 w-3" /> {log.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs truncate text-slate-400">
                      {log.errorMessage || "تمت العملية بنجاح تام."}
                    </td>
                    <td className="px-6 py-4 text-left">
                      {log.zohoResponse ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 font-mono"
                        >
                          <Code className="h-3 w-3 text-indigo-400" /> عرض الاستجابة
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedLog.operation}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  الكائن: {selectedLog.entityType} ({selectedLog.entityId})
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl bg-slate-950 p-4" dir="ltr">
              <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap text-left">
                {JSON.stringify(selectedLog.zohoResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

