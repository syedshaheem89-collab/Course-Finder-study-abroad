'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Globe2,
  Clock,
  ArrowUpRight,
  Database,
  AlertCircle
} from 'lucide-react';

export default function DataIngestionHub() {
  // Excel upload simulation state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelUploading, setExcelUploading] = useState<boolean>(false);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);

  // PDF AI reader simulation state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);

  // Web sync scraper state
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({
    daad: 'Synced 2 hours ago',
    ireland_cao: 'Synced 1 day ago',
    studielink: 'Synced 4 hours ago',
    australia_cricos: 'Synced yesterday',
  });

  // Handle Excel Upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExcelFile(file);
      setExcelUploading(true);
      setExcelSuccess(null);

      // Simulate bulk ingestion processing
      setTimeout(() => {
        setExcelUploading(false);
        setExcelSuccess(`Successfully staged 48 course records from "${file.name}" to Supabase courses table.`);
      }, 1500);
    }
  };

  // Handle PDF Criteria Extraction via AI
  const handlePdfExtract = async () => {
    if (!pdfFile) return;
    setPdfExtracting(true);
    setPdfResult(null);

    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('university_name', 'Technical University Prospectus');

    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setPdfResult(data.data);
      }
    } catch (err) {
      console.error('PDF parsing error:', err);
    } finally {
      setPdfExtracting(false);
    }
  };

  // Handle Web Sync Trigger
  const triggerSync = (siteKey: string) => {
    setSyncingMap((prev) => ({ ...prev, [siteKey]: true }));
    setTimeout(() => {
      setSyncingMap((prev) => ({ ...prev, [siteKey]: false }));
      setSyncStatus((prev) => ({ ...prev, [siteKey]: 'Just synced via Render Scraper' }));
    }, 2000);
  };

  return (
    <section id="data-hub" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            Data Ingestion Hub
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bulk ingest university curricula, extract admission constraints from brochures with Gemini AI, and trigger scrapers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========================================================================= */}
        {/* 1. EXCEL / CSV UPLOADER ZONE */}
        {/* ========================================================================= */}
        <div id="excel-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Excel / CSV Bulk Uploader</h3>
                <p className="text-[11px] text-slate-400">Upload structured batches to Supabase</p>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-emerald-500/5">
              <UploadCloud className="w-8 h-8 text-emerald-400 mb-2" />
              <span className="text-xs font-semibold text-slate-200">
                {excelFile ? excelFile.name : 'Click or drag course catalog file'}
              </span>
              <span className="text-[10px] text-slate-400 mt-1">Supports .xlsx, .xls, .csv files</span>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </label>

            {excelUploading && (
              <div className="mt-3 text-xs text-emerald-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Parsing rows and validating schema...
              </div>
            )}

            {excelSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{excelSuccess}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-[11px] text-slate-500">
            <span>Expected format: standard CSV template</span>
            <span className="text-cyan-400 cursor-pointer hover:underline">Download Template</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. PDF READER ZONE (AI BROCHURE EXTRACTION) */}
        {/* ========================================================================= */}
        <div id="pdf-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">PDF Brochure Reader</h3>
                <p className="text-[11px] text-slate-400">Extract admission criteria via AI</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-white/10 hover:border-amber-500/50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-amber-500/5">
              <FileText className="w-6 h-6 text-amber-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-200">
                {pdfFile ? pdfFile.name : 'Select University Brochure (PDF)'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Prospectus, intake guides up to 25MB</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPdfFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>

            {/* AI Extraction Button */}
            <button
              onClick={handlePdfExtract}
              disabled={!pdfFile || pdfExtracting}
              className={`w-full mt-3 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                pdfExtracting
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : pdfFile
                  ? 'neon-btn-cyan'
                  : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              {pdfExtracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Gemini LLM Extracting Criteria...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Extract Criteria via AI
                </>
              )}
            </button>

            {/* AI Parsed Results Preview */}
            {pdfResult && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <span className="font-semibold text-amber-300 block">
                  Extracted {pdfResult.extracted_programs_count} Programs:
                </span>
                {pdfResult.parsed_records.map((r: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/10">
                    <span className="font-bold text-white">{r.program_name}</span>
                    <span className="text-slate-400 block">
                      Fee: €{r.tuition_fees_eur} • Min IELTS: {r.eligibility.min_ielts} • Score: {r.eligibility.min_degree_percent}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Powered by /api/parse-pdf</span>
            <span className="text-amber-400">Gemini 1.5 Flash</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. WEB SYNC MANAGER */}
        {/* ========================================================================= */}
        <div id="web-sync" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Web Sync Manager</h3>
                <p className="text-[11px] text-slate-400">Scraper cron & manual triggers</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'daad', name: 'DAAD Germany Portal', target: 'Tuition & Semesterbeitrag' },
                { key: 'ireland_cao', name: 'Ireland Higher Education', target: 'Intakes & Fees' },
                { key: 'studielink', name: 'Studielink Netherlands', target: 'Deadlines & Visas' },
                { key: 'australia_cricos', name: 'CRICOS Australia Course Registry', target: 'Work Rights' },
              ].map((site) => (
                <div
                  key={site.key}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">{site.name}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {syncStatus[site.key]}
                    </span>
                  </div>
                  <button
                    onClick={() => triggerSync(site.key)}
                    disabled={syncingMap[site.key]}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {syncingMap[site.key] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Trigger Sync
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Target Worker: Python (Render)</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Auto-sync daily
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
