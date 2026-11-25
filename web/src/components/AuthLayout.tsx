import type { ReactNode } from 'react';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white shadow-sm">
          ৳
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-slate-900">Order &amp; Billing</p>
          <p className="text-xs text-slate-500">Order entry, memos, and sales summary</p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Private workspaces. Access requires administrator approval.
      </p>
    </div>
  );
}
