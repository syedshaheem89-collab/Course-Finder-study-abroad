import AdminSidebar from '@/components/admin-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#07080c] text-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 glass-panel border-b border-white/5 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Environment:</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Supabase Production
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Render Python Scraper Worker:</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Healthy
            </span>
          </div>
        </header>
        <main className="p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
