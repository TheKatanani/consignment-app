import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "نظام إدارة بضاعة الأمانة والتوزيع DSD | مزامنة وتسوية Zoho Inventory",
  description: "نظام متكامل لتتبع إرساليات بضاعة الأمانة، مطابقة المخزون عبر الباركود، ومزامنة فواتير التسوية مع Zoho Inventory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className={`min-h-screen bg-slate-950 text-slate-100 antialiased ${cairo.className}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
