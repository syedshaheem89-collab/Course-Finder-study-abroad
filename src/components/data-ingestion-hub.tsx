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
  Layers
} from 'lucide-react';
import { GLOBAL_COUNTRIES } from './country-rules-manager';

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
  english_policy: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT';
  course_url: string;
}

export default function DataIngestionHub() {
  const [selectedUniversity, setSelectedUniversity] = useState<string>('MCAST (Malta College of Arts, Science & Technology)');
  const [selectedCountry, setSelectedCountry] = useState<string>('Malta');
  const [selectedStayBack] = useState<number>(1.0);
  const [countryMinPercent, setCountryMinPercent] = useState<number>(50);
  const [overrideExcelPercent, setOverrideExcelPercent] = useState<boolean>(true);
  const [countryEnglishPolicy, setCountryEnglishPolicy] = useState<'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT'>('MOI_ACCEPTED');

  const [sheetRawData, setSheetRawData] = useState<any[][]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [courseCol, setCourseCol] = useState<string>('');
  const [tuitionCol, setTuitionCol] = useState<string>('');
  const [levelCol, setLevelCol] = useState<string>('');
  const [durationCol, setDurationCol] = useState<string>('');
  const [entryReqCol, setEntryReqCol] = useState<string>('');
  const [englishCol, setEnglishCol] = useState<string>('');
  const [headerIndex, setHeaderIndex] = useState<number>(1);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

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

        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes('course') && !lower.includes('mqf') && !lower.includes('level')) setCourseCol(h);
          if (lower.includes('tuition')) setTuitionCol(h);
          if (lower.includes('mqf') || lower.includes('level') || lower.includes('degree')) setLevelCol(h);
          if (lower.includes('duration')) setDurationCol(h);
          if (lower.includes('entry') || lower.includes('requirement')) setEntryReqCol(h);
          if (lower.includes('english') || lower.includes('ielts')) setEnglishCol(h);
        });

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

      let fee = 0;
      if (tIdx !== -1 && row[tIdx] !== undefined) {
        const num = String(row[tIdx]).replace(/,/g, '').match(/\d+/);
        if (num) fee = Number(num[0]);
      }

      const rawMqf = lIdx !== -1 ? String(row[lIdx] || '') : '';
      const lowerTitle = cleanTitle.toLowerCase();
      let degreeLevel = 'Master';
      if (lowerTitle.includes('pg certificate') || lowerTitle.includes('postgraduate certificate')) {
        degreeLevel = 'PG Certificate';
      } else if (lowerTitle.includes('certificate') || lowerTitle.includes('award')) {
        degreeLevel = 'Certificate';
      } else if (rawMqf.includes('7') || lowerTitle.includes('master') || lowerTitle.includes('post graduate') || lowerTitle.includes('postgraduate') || lowerTitle.includes('msc') || lowerTitle.includes('mba')) {
        degreeLevel = lowerTitle.includes('diploma') ? 'PG Diploma' : 'Master';
      } else if (lowerTitle.includes('foundation') || lowerTitle.includes('ug diploma') || lowerTitle.includes('undergraduate diploma')) {
        degreeLevel = 'UG Diploma';
      } else if (rawMqf.includes('6') || rawMqf.includes('5') || lowerTitle.includes('bachelor') || lowerTitle.includes('bsc') || lowerTitle.includes('b.sc') || lowerTitle.includes('undergraduate') || lowerTitle.includes('ug')) {
        degreeLevel = lowerTitle.includes('diploma') ? 'UG Diploma' : 'Bachelor';
      }

      const rawDur = dIdx !== -1 ? String(row[dIdx] || '') : '1 Year';
      let durationMonths = 12;
      if (rawDur.includes('2')) durationMonths = 24;
      else if (rawDur.includes('3')) durationMonths = 36;
      else if (rawDur.includes('18')) durationMonths = 18;
      else if (rawDur.includes('6')) durationMonths = 6;

      const rawEntry = eIdx !== -1 ? String(row[eIdx] || '') : '';
      let minDegree = countryMinPercent;
      if (!overrideExcelPercent) {
        const percentMatch = rawEntry.match(/(\d+)%/);
        if (percentMatch) minDegree = Number(percentMatch[1]);
      }

      const rawEng = engIdx !== -1 ? String(row[engIdx] || '') : '';
      let minIelts = 6.0;
      let effectivePolicy = countryEnglishPolicy;
      if (rawEng.toLowerCase().includes('moi') || countryEnglishPolicy === 'MOI_ACCEPTED') {
        minIelts = 5.5;
        effectivePolicy = 'MOI_ACCEPTED';
      } else if (countryEnglishPolicy === 'WAIVED' || countryEnglishPolicy === 'NO_REQUIREMENT') {
        minIelts = 0;
        effectivePolicy = countryEnglishPolicy;
      } else {
        const ieltsMatch = rawEng.match(/([5-8](\.\d)?)/);
        if (ieltsMatch) minIelts = Number(ieltsMatch[1]);
      }

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
        min_12th_percent: minDegree,
        min_ielts: minIelts,
        interview_required: cleanTitle.toLowerCase().includes('interview'),
        english_policy: effectivePolicy,
        course_url: 'https://mcast.edu.mt',
      });
    });

    setPreviewRows(parsed);
  };

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
        setCommitSuccess(`Successfully saved ${data.inserted_count} courses under "${selectedUniversity}" (${selectedCountry})!`);
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Data Ingestion Hub
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Step 1: Pick Country &amp; University. Step 2: Upload Excel, PDF, or trigger Web Sync. Step 3: Preview &amp; Save.
        </p>
      </div>

      {/* STEP 1: TARGET INSTITUTION */}
      <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Step 1: Target Institution &amp; Country Defaults
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
            Applied to uploaded courses
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Select Country
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                const c = e.target.value;
                setSelectedCountry(c);
                if (c === 'Malta') {
                  setCountryMinPercent(50);
                  setCountryEnglishPolicy('MOI_ACCEPTED');
                } else if (c === 'Germany') {
                  setCountryMinPercent(70);
                  setCountryEnglishPolicy('IELTS_TOEFL');
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 focus:outline-none focus:border-cyan-500 font-bold"
            >
              {GLOBAL_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> University Name
            </label>
            <input
              type="text"
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              placeholder="e.g. MCAST, Trinity College..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Academic Cutoff Rule (%)
              </label>
              <label className="flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 cursor-pointer" title="Override Excel percentage with this number">
                <input
                  type="checkbox"
                  checked={overrideExcelPercent}
                  onChange={(e) => setOverrideExcelPercent(e.target.checked)}
                  className="accent-cyan-600 rounded cursor-pointer"
                />
                <span>Apply to All</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="number"
                value={countryMinPercent}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCountryMinPercent(val);
                  if (overrideExcelPercent && previewRows.length > 0) {
                    setPreviewRows((prev) =>
                      prev.map((r) => ({ ...r, min_degree_percent: val, min_12th_percent: val }))
                    );
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-cyan-500 font-bold"
              />
              <span className="absolute right-3.5 top-2 text-xs text-slate-400">%</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              English / Language Rule
            </label>
            <select
              value={countryEnglishPolicy}
              onChange={(e) => setCountryEnglishPolicy(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-300 focus:outline-none focus:border-cyan-500 font-bold"
            >
              <option value="MOI_ACCEPTED">MOI Accepted (Medium of Instruction)</option>
              <option value="WAIVED">English Score Waived</option>
              <option value="NO_REQUIREMENT">No Language Requirement</option>
              <option value="IELTS_TOEFL">Standard IELTS / TOEFL Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* STEP 2: UPLOAD CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Excel Upload */}
        <div id="excel-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Step 2: Choose Excel File</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Any university spreadsheet</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-emerald-500 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50 dark:bg-white/5 hover:bg-emerald-500/5">
              <UploadCloud className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {excelFile ? excelFile.name : 'Click to select or drop Excel (.xlsx/.csv)'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Auto-detects columns &amp; shows preview
              </span>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {commitSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{commitSuccess}</span>
              </div>
            )}

            {excelError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{excelError}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>
              Recognized: <strong className="text-emerald-600 dark:text-emerald-400">{previewRows.length}</strong>
            </span>
            {previewRows.length > 0 && (
              <a href="#excel-preview-table" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">
                View Preview ↓
              </a>
            )}
          </div>
        </div>

        {/* PDF Reader */}
        <div id="pdf-zone" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">PDF Brochure Reader</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Extract criteria via AI</p>
              </div>
            </div>

            <label className="border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-amber-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50 dark:bg-white/5 hover:bg-amber-500/5">
              <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-1" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {pdfFile ? pdfFile.name : 'Select University Brochure (PDF)'}
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
                pdfExtracting
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : pdfFile
                  ? 'neon-btn-cyan'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
              }`}
            >
              {pdfExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {pdfExtracting ? 'Extracting...' : 'Extract Criteria via AI'}
            </button>

            {pdfResult && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-slate-700 dark:text-slate-200">
                Extracted {pdfResult.extracted_programs_count} programs from brochure.
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Powered by Gemini 1.5 Flash</span>
          </div>
        </div>

        {/* Web Sync Manager */}
        <div id="web-sync" className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Web Sync Manager</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Trigger scrapers for fees</p>
              </div>
            </div>

            <div className="space-y-2">
              {['daad', 'ireland_cao', 'studielink'].map((key) => (
                <div
                  key={key}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                    {key.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => {
                      setSyncingMap((p) => ({ ...p, [key]: true }));
                      setTimeout(() => setSyncingMap((p) => ({ ...p, [key]: false })), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingMap[key] ? 'animate-spin' : ''}`} />
                    Trigger Manual Sync
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">● Python Worker Ready</span>
          </div>
        </div>
      </div>

      {/* STEP 3: COLUMN MAPPER */}
      {availableColumns.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Step 3: Match Your Excel Columns
            </h3>
            <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
              Confirm which Excel column maps to each field:
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {[
              { label: 'Course Title', val: courseCol, key: 'course' as const },
              { label: 'Tuition Fee', val: tuitionCol, key: 'tuition' as const },
              { label: 'MQF / Level', val: levelCol, key: 'level' as const },
              { label: 'Duration', val: durationCol, key: 'duration' as const },
              { label: 'Entry Req (%)', val: entryReqCol, key: 'entry' as const },
              { label: 'English / IELTS', val: englishCol, key: 'english' as const },
            ].map((item) => (
              <div key={item.key}>
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {item.label}
                </label>
                <select
                  value={item.val}
                  onChange={(e) => applyColumnMapping(e.target.value, item.key)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold"
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW TABLE */}
      {previewRows.length > 0 && (
        <div id="excel-preview-table" className="glass-card p-6 rounded-2xl border border-cyan-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Step 4: Preview &amp; Confirm ({previewRows.length} Courses Found)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Will be saved to <strong className="text-cyan-700 dark:text-cyan-300">{selectedUniversity}</strong> ({selectedCountry}).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewRows([])}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitUpload}
                disabled={committing}
                className="neon-btn-emerald px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {committing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {committing ? 'Saving...' : `Confirm & Save All ${previewRows.length} Courses`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 max-h-96">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 uppercase text-[10px] text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-3 py-2.5">Course Title</th>
                  <th className="px-3 py-2.5">Level</th>
                  <th className="px-3 py-2.5">Tuition Fee (€)</th>
                  <th className="px-3 py-2.5">Min Cutoff %</th>
                  <th className="px-3 py-2.5">Language Rule</th>
                  <th className="px-3 py-2.5 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                {previewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 max-w-sm">
                      <span className="font-semibold text-slate-900 dark:text-white block">{row.program_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-medium">
                        {row.degree_level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        €{row.tuition_fees_eur.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.min_degree_percent}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPreviewRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, min_degree_percent: val, min_12th_percent: val }
                                : r
                            )
                          );
                        }}
                        className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold">
                        {row.english_policy === 'MOI_ACCEPTED'
                          ? 'MOI Accepted'
                          : row.english_policy === 'WAIVED'
                          ? 'Waived'
                          : row.english_policy === 'NO_REQUIREMENT'
                          ? 'No Requirement'
                          : `IELTS ${row.min_ielts}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setPreviewRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
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
