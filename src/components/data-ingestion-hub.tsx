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
  Database,
  AlertCircle,
  Eye,
  Check,
  Trash2,
  Building2,
  MapPin,
  Clock,
  Euro
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
  // Manual General Defaults (Selected once by admin before upload)
  const [selectedUniversity, setSelectedUniversity] = useState<string>('MCAST (Malta College of Arts, Science & Technology)');
  const [selectedCountry, setSelectedCountry] = useState<string>('Malta');
  const [selectedStayBack, setSelectedStayBack] = useState<number>(1.0);

  // Excel state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  // PDF & Scraper state
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

  // Intelligent Excel Parser (Handles title banners, header rows, messy columns)
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

        // 1. Convert sheet to 2D array of rows
        const rawAoA: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawAoA || rawAoA.length < 2) {
          setExcelError('The selected spreadsheet contains no data rows.');
          return;
        }

        // 2. Locate header row (look for "Course", "Program", "Title", "MQF", "Degree")
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawAoA.length, 10); i++) {
          const rowStr = (rawAoA[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('course') || rowStr.includes('program') || rowStr.includes('degree') || rowStr.includes('tuition')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers: string[] = (rawAoA[headerRowIndex] || []).map((h: any) =>
          String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
        );

        const dataRows = rawAoA.slice(headerRowIndex + 1);

        const parsed: ParsedPreviewRow[] = [];

        dataRows.forEach((row, idx) => {
          if (!row || row.length === 0 || !row.some((cell: any) => cell !== undefined && cell !== '')) return;

          const getCellByMatch = (matches: string[]) => {
            for (let c = 0; c < headers.length; c++) {
              for (const m of matches) {
                if (headers[c].includes(m)) {
                  return row[c];
                }
              }
            }
            return undefined;
          };

          // Program title extraction
          const rawCourse = getCellByMatch(['course', 'program', 'title']) || row[0];
          if (!rawCourse || String(rawCourse).trim().toLowerCase() === 'course') return; // ignore subheaders
          const programTitle = String(rawCourse).replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();

          // Duration extraction
          const rawDuration = getCellByMatch(['duration', 'year', 'month']) || '1 Year';
          let durationMonths = 12;
          if (String(rawDuration).toLowerCase().includes('2')) durationMonths = 24;
          else if (String(rawDuration).toLowerCase().includes('3')) durationMonths = 36;
          else if (String(rawDuration).toLowerCase().includes('18')) durationMonths = 18;

          // MQF Level / Degree Level
          const rawMqf = getCellByMatch(['mqf', 'level', 'degree']);
          let degreeLevel = 'Master';
          if (String(rawMqf).includes('7') || programTitle.toLowerCase().includes('post graduate') || programTitle.toLowerCase().includes('master')) {
            degreeLevel = 'Postgraduate';
          } else if (String(rawMqf).includes('6') || programTitle.toLowerCase().includes('bachelor')) {
            degreeLevel = 'Bachelor';
          }

          // Tuition fees extraction
          const rawFee = getCellByMatch(['tuitionfee', 'tuition', 'fee']);
          let fee = 0;
          if (rawFee) {
            const numStr = String(rawFee).replace(/[^0-9.]/g, '');
            fee = Number(numStr) || 0;
          }

          // Requirements & Entry percentage
          const rawReq = getCellByMatch(['entry', 'requirements', 'admission']);
          let minDegree = 50;
          if (rawReq) {
            const matchPercent = String(rawReq).match(/(\d+)%/);
            if (matchPercent) minDegree = Number(matchPercent[1]);
          }

          // English Language Requirements
          const rawEng = getCellByMatch(['english', 'language', 'ielts']);
          let minIelts = 6.0;
          if (rawEng && String(rawEng).toLowerCase().includes('moi')) {
            minIelts = 5.5; // Medium of Instruction accepted
          } else if (rawEng) {
            const matchIelts = String(rawEng).match(/([5-8](\.\d)?)/);
            if (matchIelts) minIelts = Number(matchIelts[1]);
          }

          // Determine Category
          let category = 'Business & Management';
          const lowerTitle = programTitle.toLowerCase();
          if (lowerTitle.includes('comput') || lowerTitle.includes('software') || lowerTitle.includes('ai') || lowerTitle.includes('informati') || lowerTitle.includes('it')) {
            category = 'Computer Science & AI';
          } else if (lowerTitle.includes('data') || lowerTitle.includes('analytic')) {
            category = 'Data Science';
          } else if (lowerTitle.includes('logistic') || lowerTitle.includes('supply') || lowerTitle.includes('transport')) {
            category = 'Engineering';
          }

          parsed.push({
            id: `row-${idx}`,
            university: selectedUniversity,
            country: selectedCountry,
            program_name: programTitle,
            degree_level: degreeLevel,
            category: category,
            duration_months: durationMonths,
            tuition_fees_eur: fee,
            intake: 'October, February',
            stay_back_visa_years: selectedStayBack,
            average_graduate_salary: 38000,
            min_degree_percent: minDegree,
            min_12th_percent: 55,
            min_ielts: minIelts,
            interview_required: false,
            course_url: 'https://mcast.edu.mt',
          });
        });

        setPreviewRows(parsed);
      } catch (err: any) {
        setExcelError(`Error reading Excel: ${err.message}`);
      }
    }
  };

  const removePreviewRow = (rowId: string) => {
    setPreviewRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const updatePreviewCell = (rowId: string, field: keyof ParsedPreviewRow, val: any) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r))
    );
  };

  // Commit verified preview rows to live Supabase
  const handleCommitUpload = async () => {
    if (previewRows.length === 0) return;
    setCommitting(true);
    setCommitSuccess(null);
    setExcelError(null);

    // Apply the chosen university and country to all rows
    const rowsToCommit = previewRows.map((r) => ({
      ...r,
      university: selectedUniversity,
      country: selectedCountry,
      stay_back_visa_years: selectedStayBack,
    }));

    try {
      const res = await fetch('/api/ingest-excel/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToCommit }),
      });

      const data = await res.json();
      if (data.success) {
        setCommitSuccess(`Successfully confirmed & added ${data.inserted_count} courses under "${selectedUniversity}" (${selectedCountry}) into Supabase!`);
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

  return (
    <section id="data-hub" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          Data Ingestion Hub
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Select the University & Country once, then Excel will automatically extract all courses, fees, and requirements with preview.
        </p>
      </div>

      {/* Manual General Defaults Box (University, Country, Stay Back) */}
      <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">1. Select Target Institution (General Settings for Excel)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" /> University / College Name
            </label>
            <input
              type="text"
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              placeholder="e.g. MCAST, Trinity College, TU Munich..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Country Location
            </label>
            <input
              type="text"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              placeholder="e.g. Malta, Germany, Ireland..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> Post-Study Stay Back (Years)
            </label>
            <input
              type="number"
              step="0.5"
              value={selectedStayBack}
              onChange={(e) => setSelectedStayBack(Number(e.target.value))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========================================================================= */}
        {/* EXCEL FILE DROPZONE */}
        {/* ========================================================================= */}
        <div id="excel-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">2. Upload Spreadsheet</h3>
                <p className="text-[11px] text-slate-400">Reads courses, fees & eligibility</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-emerald-500/5">
              <UploadCloud className="w-7 h-7 text-emerald-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-200">
                {excelFile ? excelFile.name : 'Click to select or drop mcast -1.xlsx'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Supports any header formatting</span>
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
            <span>Identified Courses: <strong className="text-emerald-400">{previewRows.length}</strong></span>
            {previewRows.length > 0 && (
              <a href="#excel-preview-table" className="text-cyan-400 font-semibold hover:underline">
                View Preview Table ↓
              </a>
            )}
          </div>
        </div>

        {/* PDF ZONE */}
        <div id="pdf-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">PDF Brochure Reader</h3>
                <p className="text-[11px] text-slate-400">Extract criteria via Gemini AI</p>
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
              onClick={async () => {
                if (!pdfFile) return;
                setPdfExtracting(true);
                const fd = new FormData();
                fd.append('file', pdfFile);
                fd.append('university_name', selectedUniversity);
                const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd });
                const d = await res.json();
                if (d.success) setPdfResult(d.data);
                setPdfExtracting(false);
              }}
              disabled={!pdfFile || pdfExtracting}
              className={`w-full mt-3 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                pdfExtracting ? 'bg-amber-500/20 text-amber-300' : pdfFile ? 'neon-btn-cyan' : 'bg-white/5 text-slate-500'
              }`}
            >
              {pdfExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {pdfExtracting ? 'Extracting...' : 'Extract via AI'}
            </button>
          </div>
          <div className="pt-3 border-t border-white/10 mt-3 text-[11px] text-slate-500">
            <span>Powered by Gemini 1.5 Flash</span>
          </div>
        </div>

        {/* WEB SYNC */}
        <div id="web-sync" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Web Sync Manager</h3>
                <p className="text-[11px] text-slate-400">Trigger scrapers for fees</p>
              </div>
            </div>

            <div className="space-y-2">
              {['daad', 'ireland_cao', 'studielink'].map((key) => (
                <div key={key} className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-200 capitalize">{key.replace('_', ' ')}</span>
                  <button
                    onClick={() => {
                      setSyncingMap((p) => ({ ...p, [key]: true }));
                      setTimeout(() => setSyncingMap((p) => ({ ...p, [key]: false })), 2000);
                    }}
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
      {/* 3. VERIFICATION PREVIEW TABLE */}
      {/* ========================================================================= */}
      {previewRows.length > 0 && (
        <div id="excel-preview-table" className="glass-card p-6 rounded-2xl border border-cyan-500/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                3. Verify Extracted Courses ({previewRows.length} Found)
              </h3>
              <p className="text-xs text-slate-400">
                These will be assigned to <strong className="text-cyan-300">{selectedUniversity}</strong> in <strong className="text-emerald-300">{selectedCountry}</strong> with <strong className="text-purple-300">{selectedStayBack} Year Stay Back</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewRows([])}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitUpload}
                disabled={committing}
                className="neon-btn-emerald px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {committing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {committing ? 'Saving to Database...' : `Confirm & Save ${previewRows.length} Courses`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 max-h-96">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/95 sticky top-0 uppercase text-[10px] text-slate-400 tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-3 py-2.5">Extracted Course Title</th>
                  <th className="px-3 py-2.5">Degree Level</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Fee (€)</th>
                  <th className="px-3 py-2.5">Min Degree %</th>
                  <th className="px-3 py-2.5">IELTS</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 max-w-xs">
                      <input
                        type="text"
                        value={row.program_name}
                        onChange={(e) => updatePreviewCell(row.id, 'program_name', e.target.value)}
                        className="w-full bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.degree_level}
                        onChange={(e) => updatePreviewCell(row.id, 'degree_level', e.target.value)}
                        className="w-24 bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category}
                        onChange={(e) => updatePreviewCell(row.id, 'category', e.target.value)}
                        className="bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="Computer Science & AI">Computer Science & AI</option>
                        <option value="Data Science">Data Science</option>
                        <option value="Engineering">Engineering & Logistics</option>
                        <option value="Business & Management">Business & Management</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.tuition_fees_eur}
                        onChange={(e) => updatePreviewCell(row.id, 'tuition_fees_eur', Number(e.target.value))}
                        className="w-20 bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-emerald-400 font-bold"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.min_degree_percent}
                        onChange={(e) => updatePreviewCell(row.id, 'min_degree_percent', Number(e.target.value))}
                        className="w-16 bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={row.min_ielts}
                        onChange={(e) => updatePreviewCell(row.id, 'min_ielts', Number(e.target.value))}
                        className="w-16 bg-slate-900/90 border border-white/10 rounded px-2 py-1 text-xs text-cyan-400 font-bold"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removePreviewRow(row.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove row"
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
