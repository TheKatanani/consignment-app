"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PackageSearch, ShieldCheck, UserCheck, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error === "CredentialsSignin" ? "بيانات الدخول غير صحيحة، يرجى المحاولة مجدداً." : result.error);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("حدث خطأ غير متوقع أثناء تسجيل الدخول.");
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* الهيدر والعنوان */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <PackageSearch className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">نظام بضاعة الأمانة والتوزيع DSD</h1>
          <p className="mt-1 text-sm text-slate-400">تسوية المخزون ومزامنة فواتير Zoho Inventory</p>
        </div>

        {/* تنبيه الخطأ */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300 animate-in fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <p>{error}</p>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@consignment.test"
              dir="ltr"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-left"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-left"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                تسجيل الدخول إلى البوابة
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* أزرار التجربة السريعة */}
        <div className="border-t border-slate-800 pt-6">
          <p className="text-center text-xs font-medium text-slate-400 mb-3">
            حسابات تجريبية سريعة للتجربة والاختبار
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin@consignment.test", "admin123")}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/60 p-2 text-xs font-medium text-slate-200 transition hover:border-indigo-500/50 hover:bg-indigo-950/30"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              مدير النظام (Admin)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("staff@consignment.test", "staff123")}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/60 p-2 text-xs font-medium text-slate-200 transition hover:border-indigo-500/50 hover:bg-indigo-950/30"
            >
              <UserCheck className="h-4 w-4 text-amber-400" />
              مندوب ميداني (Staff)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

