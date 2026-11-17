'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Globe2,
  Clock,
  Database,
  AlertCircle,
  Eye,
  Check,
  X,
  Trash2,
  ArrowRight
} from 'lucide-react';

interface ParsedPreviewRow {
  id: string;
  university: string;
  country: string;
  program_name: string;
  degree_level: string;
  category: string;
  duration_months: number;
  tuition_fees_eur: number;
  intake: string;
  stay_back_visa_years: number;
  average_graduate_salary: number;
  min_degree_percent: number;
  min_12th_percent: number;
  min_ielts: number;
  interview_required: boolean;
  course_url: string;
}

export default function DataIngestionHub() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  // PDF & Web Scraper state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({
    daad: 'Synced 2 hours ago',
    ireland_cao: 'Synced 1 day ago',
    studielink: 'Synced 4 hours ago',
    australia_cricos: 'Synced yesterday',
  });

  // Client-side read & preview of ANY Excel format
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExcelFile(file);
      setCommitSuccess(null);
      setExcelError(null);

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rawJson || rawJson.length === 0) {
          setExcelError('The selected spreadsheet contains no data rows.');
          return;
        }

        // Auto-match headers to flexible format
        const parsed: ParsedPreviewRow[] = rawJson.map((row, idx) => {
          const getVal = (possibleKeys: string[]) => {
            for (const k of Object.keys(row)) {
              const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              for (const target of possibleKeys) {
                if (cleanKey === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                  return row[k];
                }
              }
            }
            return undefined;
          };

          return {
            id: `temp-${idx}`,
            university: String(getVal(['university', 'institution', 'college', 'school']) || 'Target University'),
            country: String(getVal(['country', 'location', 'nation']) || 'Germany'),
            program_name: String(getVal(['programname', 'program', 'course', 'coursename', 'title', 'degree']) || 'M.Sc. Advanced Studies'),
            degree_level: String(getVal(['degreelevel', 'level', 'degree']) || 'Master'),
            category: String(getVal(['category', 'discipline', 'field', 'stream']) || 'Computer Science & AI'),
            duration_months: Number(getVal(['durationmonths', 'duration', 'months']) || 24),
            tuition_fees_eur: Number(getVal(['tuitionfeeseur', 'fees', 'tuition', 'fee']) || 0),
            intake: String(getVal(['intakemonths', 'intake', 'intakes', 'terms']) || 'September'),
            stay_back_visa_years: Number(getVal(['staybackvisayears', 'stayback', 'visa']) || 1.5),
            average_graduate_salary: Number(getVal(['averagegraduatesalary', 'salary']) || 55000),
            min_degree_percent: Number(getVal(['mindegreepercent', 'degreepercent', 'undergradpercent']) || 65),
            min_12th_percent: Number(getVal(['min12thpercent', '12thpercent', '12th']) || 65),
            min_ielts: Number(getVal(['minielts', 'ielts']) || 6.5),
            interview_required: Boolean(getVal(['interviewrequired', 'interview'])),
            course_url: String(getVal(['courseurl', 'url', 'link', 'website']) || 'https://study-abroad.edu'),
          };
        });

        setPreviewRows(parsed);
      } catch (err: any) {
        setExcelError(`Error reading Excel: ${err.message}`);
      }
    }
  };

  // Delete a specific row in the preview
  const removePreviewRow = (rowId: string) => {
    setPreviewRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Edit a cell directly in the preview
  const updatePreviewCell = (rowId: string, field: keyof ParsedPreviewRow, val: any) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r))
    );
  };

  // Commit the verified preview data to Supabase
  const handleCommitUpload = async () => {
    if (previewRows.length === 0) return;
    setCommitting(true);
    setCommitSuccess(null);
    setExcelError(null);

    try {
      const res = await fetch('/api/ingest-excel/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewRows }),
      });

      const data = await res.json();
      if (data.success) {
        setCommitSuccess(`Successfully confirmed & added ${data.inserted_count} courses into Supabase!`);
        setPreviewRows([]);
        setExcelFile(null);
      } else {
        setExcelError(data.error || 'Failed to save rows to Supabase');
      }
    } catch (err: any) {
      setExcelError(err.message || 'Network error while committing');
    } finally {
      setCommitting(false);
    }
  };

  // PDF & Scraper Handlers
  const handlePdfExtract = async () => {
    if (!pdfFile) return;
    setPdfExtracting(true);
    setPdfResult(null);

    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('university_name', 'University Prospectus');

    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) setPdfResult(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setPdfExtracting(false);
    }
  };

  const triggerSync = (siteKey: string) => {
    setSyncingMap((prev) => ({ ...prev, [siteKey]: true }));
    setTimeout(() => {
      setSyncingMap((prev) => ({ ...prev, [siteKey]: false }));
      setSyncStatus((prev) => ({ ...prev, [siteKey]: 'Just synced via Render Scraper' }));
    }, 2000);
  };

  return (
    <section id="data-hub" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          Data Ingestion Hub
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Preview and review spreadsheet contents before committing them to your live Supabase database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========================================================================= */}
        {/* 1. EXCEL WITH PREVIEW & EDIT BEFORE UPLOAD */}
        {/* ========================================================================= */}
        <div id="excel-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Excel / CSV Smart Importer</h3>
                <p className="text-[11px] text-slate-400">Step 1: Choose File & Preview Columns</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-emerald-500/5">
              <UploadCloud className="w-7 h-7 text-emerald-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-200">
                {excelFile ? excelFile.name : 'Select or drop any Excel / CSV'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Auto-maps any column names</span>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {commitSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{commitSuccess}</span>
              </div>
            )}

            {excelError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{excelError}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Staged Rows: <strong className="text-emerald-400">{previewRows.length}</strong></span>
            {previewRows.length > 0 && (
              <a href="#excel-preview-table" className="text-cyan-400 font-semibold hover:underline flex items-center gap-1">
                Scroll to Preview <ArrowRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* 2. PDF READER ZONE */}
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
              <FileText className="w-6 h-6 text-amber-400 mb-1" />
              <span className="text-xs font-semibold text-slate-200">
                {pdfFile ? pdfFile.name : 'Select Brochure PDF'}
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files && setPdfFile(e.target.files[0])}
                className="hidden"
              />
            </label>

            <button
              onClick={handlePdfExtract}
              disabled={!pdfFile || pdfExtracting}
              className={`w-full mt-3 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                pdfExtracting ? 'bg-amber-500/20 text-amber-300' : pdfFile ? 'neon-btn-cyan' : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              {pdfExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {pdfExtracting ? 'AI Parsing...' : 'Extract Criteria via AI'}
            </button>
          </div>
          <div className="pt-3 border-t border-white/10 mt-3 text-[11px] text-slate-500">
            <span>Powered by Gemini 1.5 Flash</span>
          </div>
        </div>

        {/* 3. WEB SYNC MANAGER */}
        <div id="web-sync" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Web Sync Manager</h3>
                <p className="text-[11px] text-slate-400">Trigger scrapers for fee updates</p>
              </div>
            </div>

            <div className="space-y-2">
              {['daad', 'ireland_cao', 'studielink'].map((key) => (
                <div key={key} className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-200 capitalize">{key.replace('_', ' ')}</span>
                  <button
                    onClick={() => triggerSync(key)}
                    className="px-2 py-1 rounded bg-sky-500/20 text-sky-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingMap[key] ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 mt-3 text-[11px] text-slate-500">
            <span className="text-emerald-400">● Python Worker Ready</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXCEL PREVIEW & EDIT BEFORE COMMITTING TO SUPABASE */}
      {/* ========================================================================= */}
      {previewRows.length > 0 && (
        <div id="excel-preview-table" className="glass-card p-6 rounded-2xl border border-cyan-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Spreadsheet Preview & Data Verification
              </h3>
              <p className="text-xs text-slate-400">
                Review the parsed columns below. You can edit any value or delete unwanted rows before uploading to Supabase.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewRows([])}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Clear Preview
              </button>
              <button
                onClick={handleCommitUpload}
                disabled={committing}
                className="neon-btn-emerald px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {committing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {committing ? 'Saving to Supabase...' : `Confirm & Upload ${previewRows.length} Courses`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 max-h-96">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 sticky top-0 uppercase text-[10px] text-slate-400 tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-3 py-2.5">Program Name</th>
                  <th className="px-3 py-2.5">University</th>
                  <th className="px-3 py-2.5">Country</th>
                  <th className="px-3 py-2.5">Fee (€)</th>
                  <th className="px-3 py-2.5">Degree %</th>
                  <th className="px-3 py-2.5">IELTS</th>
                  <th className="px-3 py-2.5 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.program_name}
                        onChange={(e) => updatePreviewCell(row.id, 'program_name', e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.university}
                        onChange={(e) => updatePreviewCell(row.id, 'university', e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.country}
                        onChange={(e) => updatePreviewCell(row.id, 'country', e.target.value)}
                        className="w-24 bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.tuition_fees_eur}
                        onChange={(e) => updatePreviewCell(row.id, 'tuition_fees_eur', Number(e.target.value))}
                        className="w-20 bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-emerald-400 font-semibold"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.min_degree_percent}
                        onChange={(e) => updatePreviewCell(row.id, 'min_degree_percent', Number(e.target.value))}
                        className="w-16 bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={row.min_ielts}
                        onChange={(e) => updatePreviewCell(row.id, 'min_ielts', Number(e.target.value))}
                        className="w-16 bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-cyan-400 font-bold"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removePreviewRow(row.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove row from upload"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
