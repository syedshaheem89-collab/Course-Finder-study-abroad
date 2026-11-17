import PublicNavbar from '@/components/public-navbar';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100 selection:bg-cyan-500 selection:text-white">
      <PublicNavbar />
      <div className="flex-1">{children}</div>
      <footer className="glass-panel border-t border-white/5 py-8 mt-20 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 AegisAbroad — AI Study Abroad Course Finder & Immigration Intelligence Engine.</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Powered by Next.js 15, Supabase PostgreSQL, and Gemini Document OCR.
          </p>
        </div>
      </footer>
    </div>
  );
}
