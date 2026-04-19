"use client";

export function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-[#F5F7FA] p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
