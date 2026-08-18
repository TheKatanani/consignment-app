"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Store,
  Boxes,
  ScanBarcode,
  Package,
  History,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  Shield,
  User,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const role = (session.user as { role?: string })?.role || "FIELD_STAFF";
  const isAdmin = role === "ADMIN";

  const handleSyncCatalog = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/zoho/sync-catalog", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage({
          text: data.message || "تمت مزامنة كتالوج منتجات Zoho بنجاح!",
          type: "success",
        });
      } else {
        setSyncMessage({
          text: data.error || "فشلت مزامنة كتالوج المنتجات مع Zoho",
          type: "error",
        });
      }
    } catch {
      setSyncMessage({
        text: "خطأ في الاتصال أثناء طلب مزامنة الكتالوج",
        type: "error",
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const navItems = [
    { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/stores", label: "المتاجر ونقاط البيع", icon: Store },
    { href: "/batches/new", label: "إرسالية أمانة جديدة", icon: Boxes },
    { href: "/reconciliations", label: "سجل المطابقات والجرد", icon: History },
    { href: "/products", label: "كتالوج المنتجات", icon: Package },
    { href: "/sync-logs", label: "سجلات مزامنة Zoho", icon: FileSpreadsheet },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-l border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight text-white tracking-wide">بضاعة الأمانة DSD</div>
            <div className="text-[11px] text-slate-400">مزامنة Zoho Inventory</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            القائمة الرئيسية
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-indigo-400" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 border border-slate-800 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-indigo-400 font-semibold text-xs border border-slate-700">
              {isAdmin ? <Shield className="h-4 w-4 text-emerald-400" /> : <User className="h-4 w-4 text-amber-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-semibold text-white">{session.user?.name || "المستخدم"}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    isAdmin
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                      : "bg-amber-950 text-amber-300 border border-amber-800/50"
                  }`}
                >
                  {isAdmin ? "مدير النظام (Admin)" : "مندوب ميداني (Staff)"}
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="تسجيل الخروج"
              className="text-slate-400 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="text-xs font-medium text-slate-400 hidden sm:inline">
              نظام إدارة وتسوية بضاعة الأمانة والتوزيع المباشر
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Now Button */}
            <button
              onClick={handleSyncCatalog}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-indigo-500 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "جاري مزامنة Zoho..." : "مزامنة كتالوج المنتجات"}</span>
            </button>

            {/* User indicator */}
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-300 font-mono text-[11px]">{session.user?.email}</span>
            </div>
          </div>
        </header>

        {/* Sync Toast Alert */}
        {syncMessage && (
          <div
            className={`mx-6 mt-4 flex items-center gap-3 rounded-lg border p-3 text-sm animate-in slide-in-from-top-2 ${
              syncMessage.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                : "border-rose-500/30 bg-rose-950/40 text-rose-300"
            }`}
          >
            {syncMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{syncMessage.text}</span>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-800 bg-slate-900 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                <item.icon className="h-4 w-4 text-indigo-400" />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

