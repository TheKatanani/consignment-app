"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Store as StoreIcon,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

interface StoreOption {
  id: string;
  name: string;
  address: string | null;
  zohoWarehouseId: string | null;
}

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  price: string | number;
}

interface BatchLineDraft {
  product: ProductItem;
  sentQty: number;
}

export default function NewBatchPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [lines, setLines] = useState<BatchLineDraft[]>([]);

  // Product Autocomplete State
  const [productQuery, setProductQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data.stores || []);
      if (data.stores && data.stores.length > 0) {
        setSelectedStoreId(data.stores[0].id);
      }
    } catch {
      setError("فشل في تحميل قائمة المتاجر ونقاط البيع.");
    }
  };

  const searchProducts = async (q: string) => {
    setProductQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setSearchResults(data.products || []);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleAddProduct = (product: ProductItem) => {
    const existingIndex = lines.findIndex((l) => l.product.id === product.id);
    if (existingIndex !== -1) {
      const updated = [...lines];
      updated[existingIndex].sentQty += 1;
      setLines(updated);
    } else {
      setLines([...lines, { product, sentQty: 5 }]);
    }
    setProductQuery("");
    setSearchResults([]);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, sentQty: Math.max(1, qty) } : l))
    );
  };

  const handleRemoveLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) {
      setError("يرجى اختيار المتجر أو نقطة البيع.");
      return;
    }
    if (lines.length === 0) {
      setError("يرجى إضافة منتج واحد على الأقل إلى إرسالية بضاعة الأمانة.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        storeId: selectedStoreId,
        items: lines.map((l) => ({
          productId: l.product.id,
          sentQty: l.sentQty,
        })),
      };

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل في إنشاء إرسالية بضاعة الأمانة.");
      }

      router.push(`/batches/${data.batch.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء إرسال الشحنة.");
      setSubmitting(false);
    }
  };

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 mb-2 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" /> العودة إلى لوحة التحكم
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Boxes className="h-7 w-7 text-indigo-400" />
          إنشاء إرسالية بضاعة أمانة جديدة
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          حدد المتجر المستلم، أضف المنتجات والكميات الموردة كأمانة، وتتم المزامنة التلقائية مع أمر التحويل في Zoho Inventory.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-300">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitBatch} className="space-y-6">
        {/* Store Selection Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-indigo-400" />
            1. اختيار المتجر المستلم (نقطة البيع)
          </label>

          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.zohoWarehouseId ? `(مربوط بمستودع: ${s.zohoWarehouseId})` : "(بدون مستودع زوهو)"}
              </option>
            ))}
          </select>

          {/* Zoho Warehouse Linkage Notification */}
          {selectedStore && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              {selectedStore.zohoWarehouseId ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <CheckCircle2 className="h-4 w-4" />
                  مربوط بمستودع زوهو: <strong>{selectedStore.zohoWarehouseId}</strong> (سيتم إنشاء أمر تحويل Transfer Order تلقائياً)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Warehouse className="h-4 w-4" />
                  غير مربوط بمستودع زوهو — سيتم حفظ الإرسالية محلياً دون استدعاء أمر التحويل في زوهو.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Product Search & Line Items Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              2. البحث وإضافة المنتجات بالباركود (SKU) أو الاسم
            </label>
            <div className="relative">
              <input
                type="text"
                value={productQuery}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="اكتب رمز الباركود SKU (مثال: SKU-GP-001) أو اسم المنتج..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
              {searching && (
                <RefreshCw className="absolute left-3.5 top-3.5 h-4 w-4 animate-spin text-indigo-400" />
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl space-y-1">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="flex w-full items-center justify-between rounded-lg p-2.5 text-right text-xs transition hover:bg-indigo-950/40 hover:border-indigo-500/40"
                  >
                    <div>
                      <span className="font-mono font-bold text-indigo-400">{p.sku}</span>
                      <div className="text-slate-300 font-medium">{p.name}</div>
                    </div>
                    <div className="text-left">
                      <span className="font-mono text-emerald-400 font-semibold">
                        ${Number(p.price).toFixed(2)}
                      </span>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-start">
                        <Plus className="h-3 w-3" /> إضافة بند
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line Items List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              بنود إرسالية الأمانة ({lines.length})
            </h3>

            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                لم يتم إضافة أي منتجات بعد. استخدم شريط البحث أعلاه لاختيار المنتجات.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => (
                  <div
                    key={l.product.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-indigo-300">{l.product.sku}</div>
                      <div className="text-slate-300 font-medium">{l.product.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        سعر الحبة: ${Number(l.product.price).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">الكمية المرسلة:</span>
                        <input
                          type="number"
                          min={1}
                          required
                          value={l.sentQty}
                          onChange={(e) => handleUpdateQty(l.product.id, parseInt(e.target.value) || 1)}
                          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-center font-mono font-bold text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="font-mono font-bold text-white w-24 text-left">
                        ${(l.sentQty * Number(l.product.price)).toFixed(2)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(l.product.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={submitting || lines.length === 0}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
            تأكيد وإرسال الشحنة
          </button>
        </div>
      </form>
    </div>
  );
}

