import PublicNavbar from '@/components/public-navbar';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-root-container min-h-screen flex flex-col transition-colors duration-200">
      <PublicNavbar />
      <div className="flex-1">{children}</div>
      <footer className="footer-panel border-t py-8 mt-20 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 GlobalCourse AI — Next-Generation Study Abroad & Admissions Intelligence Platform.</p>
          <p className="mt-1 text-[11px] opacity-70">
            Featuring Live Country Eligibility Rules, MOI Acceptance & Multi-Format Ingestion.
          </p>
        </div>
      </footer>
    </div>
  );
}
