import PublicNavbar from '@/components/public-navbar';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090a0f] text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <PublicNavbar />
      <div className="flex-1">{children}</div>
      <footer className="glass-panel border-t border-slate-200 dark:border-white/5 py-8 mt-20 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 GlobalCourse AI — Next-Generation Study Abroad & Admissions Intelligence Platform.</p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600">
            Featuring Live Country Eligibility Rules, MOI Acceptance & Multi-Format Ingestion.
          </p>
        </div>
      </footer>
    </div>
  );
}
