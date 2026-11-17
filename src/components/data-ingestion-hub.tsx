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
  Layers,
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
  // 1. Institution Settings
  const [selectedUniversity, setSelectedUniversity] = useState<string>('MCAST (Malta College of Arts, Science & Technology)');
  const [selectedCountry, setSelectedCountry] = useState<string>('Malta');
  const [selectedStayBack, setSelectedStayBack] = useState<number>(1.0);

  // 2. Interactive Column Mapping State
  const [sheetRawData, setSheetRawData] = useState<any[][]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [courseCol, setCourseCol] = useState<string>('');
  const [tuitionCol, setTuitionCol] = useState<string>('');
  const [levelCol, setLevelCol] = useState<string>('');
  const [durationCol, setDurationCol] = useState<string>('');
  const [entryReqCol, setEntryReqCol] = useState<string>('');
  const [englishCol, setEnglishCol] = useState<string>('');
  const [headerIndex, setHeaderIndex] = useState<number>(1);

  // 3. Staged Rows
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
  });

  // Step 1: Read any Excel file and detect headers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExcelFile(file);
      setCommitSuccess(null);
      setExcelError(null);
      setPreviewRows([]);

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawAoA: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawAoA || rawAoA.length < 2) {
          setExcelError('The spreadsheet is empty.');
          return;
        }

        setSheetRawData(rawAoA);

        // Scan for header row
        let bestHeaderIdx = 0;
        for (let i = 0; i < Math.min(rawAoA.length, 10); i++) {
          const rowText = (rawAoA[i] || []).map((c) => String(c || '').toLowerCase()).join(' ');
          if (rowText.includes('course') || rowText.includes('program') || rowText.includes('tuition') || rowText.includes('fee')) {
            bestHeaderIdx = i;
            break;
          }
        }
        setHeaderIndex(bestHeaderIdx);

        const headers = (rawAoA[bestHeaderIdx] || []).map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));
        setAvailableColumns(headers);

        // Auto-detect matches
        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes('course') && !lower.includes('mqf') && !lower.includes('level')) setCourseCol(h);
          if (lower.includes('tuition')) setTuitionCol(h);
          if (lower.includes('mqf') || lower.includes('level') || lower.includes('degree')) setLevelCol(h);
          if (lower.includes('duration')) setDurationCol(h);
          if (lower.includes('entry') || lower.includes('requirement')) setEntryReqCol(h);
          if (lower.includes('english') || lower.includes('ielts')) setEnglishCol(h);
        });

        // Trigger initial parse
        generatePreviewWithMapping(rawAoA, bestHeaderIdx, headers, {
          course: headers.find((h) => h.toLowerCase().includes('course') && !h.toLowerCase().includes('mqf')) || headers[0],
          tuition: headers.find((h) => h.toLowerCase().includes('tuition')) || '',
          level: headers.find((h) => h.toLowerCase().includes('mqf') || h.toLowerCase().includes('level')) || '',
          duration: headers.find((h) => h.toLowerCase().includes('duration')) || '',
          entry: headers.find((h) => h.toLowerCase().includes('entry')) || '',
          english: headers.find((h) => h.toLowerCase().includes('english')) || '',
        });
      } catch (err: any) {
        setExcelError(`Error reading file: ${err.message}`);
      }
    }
  };

  // Step 2: Build the preview based on chosen column mapping
  const generatePreviewWithMapping = (
    aoa: any[][],
    hIdx: number,
    headers: string[],
    mapping: { course: string; tuition: string; level: string; duration: string; entry: string; english: string }
  ) => {
    const dataRows = aoa.slice(hIdx + 1);

    const getIdx = (colName: string) => headers.indexOf(colName);
    const cIdx = getIdx(mapping.course);
    const tIdx = getIdx(mapping.tuition);
    const lIdx = getIdx(mapping.level);
    const dIdx = getIdx(mapping.duration);
    const eIdx = getIdx(mapping.entry);
    const engIdx = getIdx(mapping.english);

    const parsed: ParsedPreviewRow[] = [];

    dataRows.forEach((row, idx) => {
      if (!row || row.length === 0) return;
      const rawTitle = cIdx !== -1 ? row[cIdx] : row[0];
      if (!rawTitle || typeof rawTitle !== 'string') return;
      const cleanTitle = rawTitle.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanTitle || cleanTitle.toLowerCase() === 'course') return;

      // Extract fee cleanly from the selected Tuition column
      let fee = 0;
      if (tIdx !== -1 && row[tIdx] !== undefined) {
        const num = String(row[tIdx]).replace(/,/g, '').match(/\d+/);
        if (num) fee = Number(num[0]);
      }

      // Extract MQF / Degree level
      const rawMqf = lIdx !== -1 ? String(row[lIdx] || '') : '';
      let degreeLevel = 'Master';
      if (rawMqf.includes('7') || cleanTitle.toLowerCase().includes('master') || cleanTitle.toLowerCase().includes('post graduate') || cleanTitle.toLowerCase().includes('postgraduate') || cleanTitle.toLowerCase().includes('mba')) {
        degreeLevel = cleanTitle.toLowerCase().includes('diploma') ? 'PG Diploma' : 'Master';
      } else if (rawMqf.includes('6') || cleanTitle.toLowerCase().includes('bachelor') || cleanTitle.toLowerCase().includes('undergraduate') || cleanTitle.toLowerCase().includes('ug')) {
        degreeLevel = cleanTitle.toLowerCase().includes('diploma') ? 'UG Diploma' : 'Bachelor';
      }

      // Duration
      const rawDur = dIdx !== -1 ? String(row[dIdx] || '') : '1 Year';
      let durationMonths = 12;
      if (rawDur.includes('2')) durationMonths = 24;
      else if (rawDur.includes('3')) durationMonths = 36;
      else if (rawDur.includes('18')) durationMonths = 18;
      else if (rawDur.includes('6')) durationMonths = 6;

      // Entry percentage
      const rawEntry = eIdx !== -1 ? String(row[eIdx] || '') : '';
      let minDegree = 50;
      const percentMatch = rawEntry.match(/(\d+)%/);
      if (percentMatch) minDegree = Number(percentMatch[1]);

      // IELTS
      const rawEng = engIdx !== -1 ? String(row[engIdx] || '') : '';
      let minIelts = 6.0;
      if (rawEng.toLowerCase().includes('moi')) minIelts = 5.5;
      else {
        const ieltsMatch = rawEng.match(/([5-8](\.\d)?)/);
        if (ieltsMatch) minIelts = Number(ieltsMatch[1]);
      }

      // Category
      let category = 'Business & Management';
      const lower = cleanTitle.toLowerCase();
      if (lower.includes('comput') || lower.includes('ai') || lower.includes('software') || lower.includes('artificial intelligence') || lower.includes('electronic') || lower.includes('it')) {
        category = 'Computer Science & AI';
      } else if (lower.includes('data') || lower.includes('analytics')) {
        category = 'Data Science';
      } else if (lower.includes('logistic') || lower.includes('transport') || lower.includes('engineering') || lower.includes('aviation') || lower.includes('manufacturing')) {
        category = 'Engineering';
      }

      parsed.push({
        id: `row-${idx}`,
        university: selectedUniversity,
        country: selectedCountry,
        program_name: cleanTitle,
        degree_level: degreeLevel,
        category: category,
        duration_months: durationMonths,
        tuition_fees_eur: fee,
        intake: 'October, February',
        stay_back_visa_years: selectedStayBack,
        average_graduate_salary: 38000,
        min_degree_percent: minDegree,
        min_12th_percent: 50,
        min_ielts: minIelts,
        interview_required: cleanTitle.toLowerCase().includes('interview'),
        course_url: 'https://mcast.edu.mt',
      });
    });

    setPreviewRows(parsed);
  };

  // Re-run mapping when admin changes a dropdown
  const applyColumnMapping = (newColName: string, type: 'course' | 'tuition' | 'level' | 'duration' | 'entry' | 'english') => {
    const updated = {
      course: type === 'course' ? newColName : courseCol,
      tuition: type === 'tuition' ? newColName : tuitionCol,
      level: type === 'level' ? newColName : levelCol,
      duration: type === 'duration' ? newColName : durationCol,
      entry: type === 'entry' ? newColName : entryReqCol,
      english: type === 'english' ? newColName : englishCol,
    };
    if (type === 'course') setCourseCol(newColName);
    if (type === 'tuition') setTuitionCol(newColName);
    if (type === 'level') setLevelCol(newColName);
    if (type === 'duration') setDurationCol(newColName);
    if (type === 'entry') setEntryReqCol(newColName);
    if (type === 'english') setEnglishCol(newColName);

    generatePreviewWithMapping(sheetRawData, headerIndex, availableColumns, updated);
  };

  // Commit verified rows to Supabase
  const handleCommitUpload = async () => {
    if (previewRows.length === 0) return;
    setCommitting(true);
    setCommitSuccess(null);
    setExcelError(null);

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
        setAvailableColumns([]);
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
          Data Ingestion Hub (Universal Spreadsheet Normalizer)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Step 1: Set University & Country once. Step 2: Upload any Excel. Step 3: Match columns with 1-click dropdowns to instantly standardize any country&apos;s format!
        </p>
      </div>

      {/* STEP 1: GENERAL INSTITUTION SETTINGS */}
      <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Step 1: Target Institution (General Settings)</h3>
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

      {/* STEP 2: UPLOAD ANY EXCEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="excel-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Step 2: Choose Excel File</h3>
                <p className="text-[11px] text-slate-400">Upload any country or university format</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-emerald-500/5">
              <UploadCloud className="w-7 h-7 text-emerald-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-200">
                {excelFile ? excelFile.name : 'Select or drop your Excel file'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">MCAST, DAAD, UCAS, Ireland CAO</span>
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
            <span>Recognized Courses: <strong className="text-emerald-400">{previewRows.length}</strong></span>
            {previewRows.length > 0 && (
              <a href="#excel-preview-table" className="text-cyan-400 font-semibold hover:underline">
                View Mappings & Preview ↓
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
      {/* STEP 3: INTERACTIVE COLUMN MAPPER (THE UNIVERSAL SOLVER) */}
      {/* ========================================================================= */}
      {availableColumns.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/40 bg-indigo-950/20 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Step 3: Column Mapper (Standardize This Excel File)
            </h3>
            <span className="text-[11px] text-indigo-300">
              Select which column in your Excel contains each piece of data:
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {/* Course Title Column */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Course Title Column
              </label>
              <select
                value={courseCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'course')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 font-semibold"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Tuition Fee Column */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Tuition Fee Column
              </label>
              <select
                value={tuitionCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'tuition')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 focus:outline-none focus:border-emerald-400 font-bold"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Level / MQF Column */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                MQF / Level Column
              </label>
              <select
                value={levelCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'level')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 focus:outline-none focus:border-purple-400"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Duration Column */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Duration Column
              </label>
              <select
                value={durationCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'duration')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Entry Requirement % */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Entry Req (%) Column
              </label>
              <select
                value={entryReqCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'entry')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* English / IELTS Column */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                English / IELTS Column
              </label>
              <select
                value={englishCol}
                onChange={(e) => applyColumnMapping(e.target.value, 'english')}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-bold"
              >
                {availableColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: PREVIEW RECOGNIZED COURSES & COMMIT */}
      {/* ========================================================================= */}
      {previewRows.length > 0 && (
        <div id="excel-preview-table" className="glass-card p-6 rounded-2xl border border-cyan-500/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Step 4: Review Normalized Data ({previewRows.length} Courses Found)
              </h3>
              <p className="text-xs text-slate-400">
                Linked to <strong className="text-cyan-300">{selectedUniversity}</strong> ({selectedCountry}) with <strong className="text-purple-300">{selectedStayBack}y Stay Back</strong>.
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
                {committing ? 'Saving to Database...' : `Confirm & Save All ${previewRows.length} Courses`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 max-h-96">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/95 sticky top-0 uppercase text-[10px] text-slate-400 tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-3 py-2.5">Course Title (Recognized)</th>
                  <th className="px-3 py-2.5">Degree Level</th>
                  <th className="px-3 py-2.5">Tuition Fee (€)</th>
                  <th className="px-3 py-2.5">Min Degree %</th>
                  <th className="px-3 py-2.5">IELTS</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 max-w-sm">
                      <span className="font-semibold text-white block">{row.program_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {row.degree_level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-emerald-400">
                        €{row.tuition_fees_eur.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-slate-300">{row.min_degree_percent}%</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-cyan-400">{row.min_ielts}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setPreviewRows((prev) => prev.filter((r) => r.id !== row.id))}
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
