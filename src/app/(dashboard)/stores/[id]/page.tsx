"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Store as StoreIcon,
  Boxes,
  History,
  Scan,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Edit2,
  Save,
} from "lucide-react";

interface StoreDetailData {
  id: string;
  name: string;
  address: string | null;
  zohoWarehouseId: string | null;
  createdAt: string;
  batches: Array<{
    id: string;
    status: "ACTIVE" | "RECONCILED";
    zohoTransferId: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      sentQty: number;
      product: { name: string; sku: string; price: string | number };
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
  }>;
}

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit warehouse ID inline
  const [editing, setEditing] = useState(false);
  const [warehouseInput, setWarehouseInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStore = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stores/${storeId}`);
      if (!res.ok) throw new Error("لم يتم العثور على المتجر.");
      const data = await res.json();
      setStore(data.store);
      setWarehouseInput(data.store?.zohoWarehouseId || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل بيانات المتجر.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const handleUpdateWarehouse = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zohoWarehouseId: warehouseInput.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "فشل في حفظ ربط المستودع.");
      setStore(data.store);
      setEditing(false);
      await fetchStore();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "خطأ أثناء حفظ معرف المستودع");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">جاري تحميل ملف المتجر...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center max-w-xl mx-auto">
        <h2 className="text-lg font-bold text-rose-200">المتجر غير موجود</h2>
        <p className="text-xs text-rose-300/80 mt-1">{error}</p>
        <Link href="/stores" className="mt-4 inline-block text-xs font-semibold text-indigo-400">
          العودة إلى قائمة المتاجر
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/stores"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 mb-2 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" /> العودة إلى المتاجر
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <StoreIcon className="h-7 w-7 text-indigo-400" />
            {store.name}
          </h1>
          <Link
            href={`/batches/new`}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
          >
            <Boxes className="h-4 w-4" /> إنشاء إرسالية لهذا المتجر
          </Link>
        </div>
      </div>

      {/* Store Information & Warehouse Mapping Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          بيانات المتجر وإعدادات مستودع Zoho Inventory
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-xs text-slate-400">العنوان الفعلي / الموقع:</div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-400 shrink-0" />
              {store.address || "لم يتم تحديد العنوان."}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>مستودع Zoho المرتبط:</span>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  <Edit2 className="h-3 w-3" /> تعديل الربط
                </button>
              )}
            </div>

            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={warehouseInput}
                  onChange={(e) => setWarehouseInput(e.target.value)}
                  placeholder="معرف مستودع زوهو..."
                  dir="ltr"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none text-left"
                />
                <button
                  onClick={handleUpdateWarehouse}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Save className="h-3 w-3" /> حفظ
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            ) : store.zohoWarehouseId ? (
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-950/80 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-800/40">
                  {store.zohoWarehouseId}
                </span>
                <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> المزامنة التلقائية مفعلة
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-400 border border-amber-800/40">
                  غير مربوط بمستودع في زوهو
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batches & Reconciliation History */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            سجل إرساليات الأمانة والمطابقات للمتجر ({store.batches.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">رقم الشحنة</th>
                <th className="px-6 py-3.5 font-semibold">الحالة</th>
                <th className="px-6 py-3.5 font-semibold">الأصناف / الكمية</th>
                <th className="px-6 py-3.5 font-semibold">تحويل زوهو</th>
                <th className="px-6 py-3.5 font-semibold">التاريخ</th>
                <th className="px-6 py-3.5 font-semibold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {store.batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لم يتم إرسال أي شحنات أمانة لهذا المتجر حتى الآن.
                  </td>
                </tr>
              ) : (
                store.batches.map((batch) => {
                  const totalUnits = batch.items.reduce((acc, i) => acc + i.sentQty, 0);

                  return (
                    <tr key={batch.id} className="transition hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-400">
                        <Link href={`/batches/${batch.id}`} className="hover:underline">
                          {batch.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            batch.status === "ACTIVE"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
                              : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40"
                          }`}
                        >
                          {batch.status === "ACTIVE" ? "نشطة (قيد التوزيع)" : "تمت التسوية"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-semibold text-white">{totalUnits} قطعة</div>
                        <div className="text-slate-400">{batch.items.length} أصناف</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {batch.zohoTransferId || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {new Date(batch.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-6 py-4 text-left">
                        {batch.status === "ACTIVE" ? (
                          <Link
                            href={`/batches/${batch.id}/reconcile`}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                          >
                            <Scan className="h-3.5 w-3.5" /> مطابقة المخزون
                          </Link>
                        ) : (
                          <Link
                            href={`/batches/${batch.id}/settlement`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                          >
                            عرض التسوية
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

