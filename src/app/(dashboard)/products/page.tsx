"use client";

import { useEffect, useState } from "react";
import {
  Package,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  price: string | number;
  zohoItemId: string | null;
  lastSyncedAt: string | null;
}

interface SyncStats {
  syncedCount: number;
  skippedCount: number;
  totalFetched: number;
  errors: string[];
}

export default function ProductsCatalogPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products?limit=100");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncStats(null);

    try {
      const res = await fetch("/api/zoho/sync-catalog", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "فشلت مزامنة الكتالوج.");
      }

      setSyncStats(data.data);
      await fetchProducts();
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : "حدث خطأ أثناء مزامنة الكتالوج.");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Package className="h-7 w-7 text-indigo-400" />
            كتالوج المنتجات ومزامنة Zoho Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            كتالوج المنتجات المحلي المتزامن مع Zoho مع التحقق الصارم من صحة الباركود (SKU).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "جاري مزامنة الكتالوج..." : "مزامنة الآن (Zoho ← المحلي)"}
          </button>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncStats && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 backdrop-blur-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-200">اكتملت مزامنة كتالوج Zoho بنجاح</h3>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                تمت معالجة <strong>{syncStats.totalFetched}</strong> منتج من واجهة Zoho Inventory API:
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-900/90 border border-emerald-500/20 p-3 text-xs">
              <div className="text-slate-400">تم تحديثها وإدراجها بنجاح:</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {syncStats.syncedCount} منتج
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/90 border border-amber-500/20 p-3 text-xs">
              <div className="text-slate-400">تم تخطيها (الباركود SKU فارغ أو غير صالح):</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {syncStats.skippedCount} صنف
              </div>
            </div>
          </div>

          {syncStats.errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-slate-950/80 p-3 text-xs text-amber-300 font-mono max-h-28 overflow-y-auto">
              <div className="text-[11px] font-bold text-amber-400 uppercase mb-1">
                سجل تدقيق الأصناف المتخطاة:
              </div>
              {syncStats.errors.map((err, idx) => (
                <div key={idx} className="truncate">
                  • {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {syncError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="تصفية الكتالوج برمز الباركود SKU (مثل SKU-GP-001) أو اسم المنتج..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
      </div>

      {/* Product Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">باركود المنتج (SKU)</th>
                <th className="px-6 py-3.5 font-semibold">اسم المنتج</th>
                <th className="px-6 py-3.5 font-semibold">سعر الحبة</th>
                <th className="px-6 py-3.5 font-semibold">معرف Zoho Item</th>
                <th className="px-6 py-3.5 font-semibold">سلامة الباركود</th>
                <th className="px-6 py-3.5 font-semibold text-left">آخر مزامنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    جاري تحميل كتالوج المنتجات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    لا توجد منتجات في الكتالوج المحلي. اضغط على &quot;مزامنة الآن&quot; لجلب المنتجات من Zoho.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="transition hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-400">{p.sku}</td>
                    <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400 font-semibold">
                      ${Number(p.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {p.zohoItemId || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-800/40">
                        <ShieldCheck className="h-3 w-3" /> باركود سليم ونظامي
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left text-xs text-slate-400 font-mono">
                      {p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString("ar-EG") : "بيانات أولية"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

