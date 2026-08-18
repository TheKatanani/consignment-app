"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store as StoreIcon,
  Plus,
  Search,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

interface StoreWithBatches {
  id: string;
  name: string;
  address: string | null;
  zohoWarehouseId: string | null;
  createdAt: string;
  batches: Array<{
    id: string;
    status: string;
    createdAt: string;
    reconciliations: Array<{ createdAt: string }>;
  }>;
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreWithBatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // New store form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [zohoWarehouseId, setZohoWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data.stores || []);
    } catch (err) {
      console.error("Failed to load stores:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          zohoWarehouseId: zohoWarehouseId.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل في تسجيل المتجر.");
      }

      setName("");
      setAddress("");
      setZohoWarehouseId("");
      setModalOpen(false);
      await fetchStores();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "حدث خطأ أثناء إضافة المتجر.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.zohoWarehouseId && s.zohoWarehouseId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <StoreIcon className="h-7 w-7 text-indigo-400" />
            المتاجر ونقاط البيع وربط مستودعات Zoho
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة بيانات المتاجر المعتمدة، ربط نقاط البيع بمستودعات Zoho Inventory، وتتبع إرساليات الأمانة.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
        >
          <Plus className="h-4 w-4" /> إضافة متجر جديد
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن متجر بالاسم أو العنوان أو رمز مستودع Zoho..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
          جاري تحميل المتاجر...
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
          لم يتم العثور على أي متجر يطابق معايير البحث.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStores.map((store) => {
            const activeCount = store.batches.filter((b) => b.status === "ACTIVE").length;
            const totalCount = store.batches.length;

            return (
              <div
                key={store.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-white">{store.name}</h3>
                    {store.zohoWarehouseId ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-400 border border-emerald-800/40">
                        <CheckCircle2 className="h-3 w-3" />
                        {store.zohoWarehouseId}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-800/40">
                        <AlertTriangle className="h-3 w-3" />
                        بدون مستودع زوهو
                      </span>
                    )}
                  </div>

                  {store.address && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{store.address}</span>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">إرساليات نشطة</div>
                      <div className="font-mono font-bold text-indigo-300 text-sm">{activeCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">إجمالي الشحنات</div>
                      <div className="font-mono font-bold text-slate-200 text-sm">{totalCount}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-800 pt-3 flex justify-end">
                  <Link
                    href={`/stores/${store.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    تفاصيل المتجر والشحنات <ArrowLeft className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Store Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <StoreIcon className="h-5 w-5 text-indigo-400" />
              تسجيل متجر أو نقطة بيع جديدة
            </h3>

            {formError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateStore} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  اسم المتجر / المعرض *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: فرع سيتي مول الرئيسي"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  عنوان أو موقع المتجر
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع وصفي التل، مجمع رقم 4"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span>معرف مستودع Zoho Warehouse ID (اختياري)</span>
                  <span className="text-[10px] text-slate-500 font-normal">لأوامر التحويل التلقائية</span>
                </label>
                <input
                  type="text"
                  value={zohoWarehouseId}
                  onChange={(e) => setZohoWarehouseId(e.target.value)}
                  placeholder="مثال: 4516918000012345678"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none text-left"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  إذا تُرك فارغاً، سيتم حفظ الإرساليات محلياً دون استدعاء أمر تحويل المخزون في زوهو.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "حفظ المتجر"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

