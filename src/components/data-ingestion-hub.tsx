'use client';

import { useState, useRef } from 'react';
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
import { getCountryVisaIntel } from '@/lib/country-visa-intel';
import { hasBuiltInCountryGuide } from '@/lib/student-guides';

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
  raw_excel_data?: Record<string, any>;
}

export default function DataIngestionHub() {
  const [selectedUniversity, setSelectedUniversity] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedStayBack] = useState<number>(1.0);
  const [countryMinPercent, setCountryMinPercent] = useState<number>(50);
  const [justPassCutoff, setJustPassCutoff] = useState<boolean>(false);
  const [overrideExcelPercent, setOverrideExcelPercent] = useState<boolean>(true);
  const [countryEnglishPolicy, setCountryEnglishPolicy] = useState<'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT'>('MOI_ACCEPTED');

  const [sheetRawData, setSheetRawData] = useState<any[][]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [courseCol, setCourseCol] = useState<string>('');
  const [universityCol, setUniversityCol] = useState<string>('');
  const [countryCol, setCountryCol] = useState<string>('');
  const [tuitionCol, setTuitionCol] = useState<string>('');
  const [levelCol, setLevelCol] = useState<string>('');
  const [durationCol, setDurationCol] = useState<string>('');
  const [intakeCol, setIntakeCol] = useState<string>('');
  const [entryReqCol, setEntryReqCol] = useState<string>('');
  const [englishCol, setEnglishCol] = useState<string>('');
  const [urlCol, setUrlCol] = useState<string>('');
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [newCustomKey, setNewCustomKey] = useState<string>('');
  const [newCustomVal, setNewCustomVal] = useState<string>('');
  const [excludedCols, setExcludedCols] = useState<string[]>([]);
  const [headerIndex, setHeaderIndex] = useState<number>(1);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitProgress, setCommitProgress] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string>('');
  const [ukDirectUni, setUkDirectUni] = useState<string>('');
  const [ukDirectUrl, setUkDirectUrl] = useState<string>('');
  const [hesaInstFile, setHesaInstFile] = useState<File | null>(null);
  const [hesaCourseFile, setHesaCourseFile] = useState<File | null>(null);
  const [parsingHesa, setParsingHesa] = useState<boolean>(false);
  const [enrichingAi, setEnrichingAi] = useState<boolean>(false);
  const [aiEnrichSummary, setAiEnrichSummary] = useState<string | null>(null);
  const stopSyncRef = useRef<boolean>(false);

  const runDaadFullSync = async () => {
    stopSyncRef.current = false;
    setSyncingMap((p) => ({ ...p, daad: true }));
    setSyncMessage('Connecting to DAAD Germany API...');

    let offset = 0;
    let totalInserted = 0;
    let hasMore = true;

    try {
      while (hasMore && !stopSyncRef.current) {
        const res = await fetch('/api/sync-web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'daad', limit: 100, offset }),
        });
        const data = await res.json();
        if (!data.success) {
          setSyncMessage(data.error || 'Sync paused due to API error');
          break;
        }
        totalInserted += data.inserted_count || 0;
        offset = data.next_offset || offset + 100;
        hasMore = Boolean(data.has_more);

        setSyncMessage(
          `DAAD Sync: ${offset} / ${data.total_available || '?'} checked • ${totalInserted} new courses added`
        );
      }

      if (stopSyncRef.current) {
        setSyncMessage(`Sync stopped by user. Added ${totalInserted} new DAAD courses (${offset} checked).`);
      } else if (!hasMore) {
        setSyncMessage(`Completed! Synced ${totalInserted} new DAAD Germany courses (${offset} total checked).`);
      }
    } catch (err: any) {
      setSyncMessage(err.message || 'Sync error');
    } finally {
      setSyncingMap((p) => ({ ...p, daad: false }));
    }
  };

  const processRawAoA = (rawAoA: any[][]) => {
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
    setExcludedCols([]);

    const detectedCourse =
      headers.find((h) => {
        const l = h.toLowerCase();
        return (l.includes('course') || l.includes('program') || l.includes('title')) && !l.includes('mqf') && !l.includes('level');
      }) || headers[0];
    const detectedUni =
      headers.find((h) => ['university', 'institution', 'college', 'school', 'provider'].some((k) => h.toLowerCase().includes(k))) || '';
    const detectedCountry =
      headers.find((h) => h.toLowerCase() === 'country' || h.toLowerCase().includes('destination')) || '';
    const detectedTuition =
      headers.find((h) => h.toLowerCase().includes('tuition')) ||
      headers.find((h) => {
        const l = h.toLowerCase();
        return l.includes('fee') && !l.includes('application') && !l.includes('registration');
      }) ||
      '';
    const detectedLevel =
      headers.find((h) => {
        const l = h.toLowerCase();
        return (l.includes('mqf') || l.includes('level') || l.includes('degree')) && !l.includes('fee');
      }) || '';
    const detectedDuration = headers.find((h) => h.toLowerCase().includes('duration')) || '';
    const detectedIntake = headers.find((h) => h.toLowerCase().includes('intake')) || '';
    const detectedEntry = headers.find((h) => h.toLowerCase().includes('entry') || h.toLowerCase().includes('requirement') || h.toLowerCase().includes('cutoff')) || '';
    const detectedEnglish = headers.find((h) => h.toLowerCase().includes('english') || h.toLowerCase().includes('ielts')) || '';
    const detectedUrl = headers.find((h) => h.toLowerCase().includes('url') || h.toLowerCase().includes('link')) || '';

    setCourseCol(detectedCourse);
    setUniversityCol(detectedUni);
    setCountryCol(detectedCountry);
    setTuitionCol(detectedTuition);
    setLevelCol(detectedLevel);
    setDurationCol(detectedDuration);
    setIntakeCol(detectedIntake);
    setEntryReqCol(detectedEntry);
    setEnglishCol(detectedEnglish);
    setUrlCol(detectedUrl);

    generatePreviewWithMapping(rawAoA, bestHeaderIdx, headers, {
      course: detectedCourse,
      university: detectedUni,
      country: detectedCountry,
      tuition: detectedTuition,
      level: detectedLevel,
      duration: detectedDuration,
      intake: detectedIntake,
      entry: detectedEntry,
      english: detectedEnglish,
      url: detectedUrl,
    });
  };

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

        processRawAoA(rawAoA);
      } catch (err: any) {
        setExcelError(`Error reading file: ${err.message}`);
      }
    }
  };

  const generatePreviewWithMapping = (
    aoa: any[][],
    hIdx: number,
    headers: string[],
    mapping: {
      course: string;
      university: string;
      country: string;
      tuition: string;
      level: string;
      duration: string;
      intake: string;
      entry: string;
      english: string;
      url: string;
    }
  ) => {
    const dataRows = aoa.slice(hIdx + 1);
    const getIdx = (colName: string) => (colName ? headers.indexOf(colName) : -1);
    const cIdx = getIdx(mapping.course);
    const uIdx = getIdx(mapping.university);
    const ctryIdx = getIdx(mapping.country);
    const tIdx = getIdx(mapping.tuition);
    const lIdx = getIdx(mapping.level);
    const dIdx = getIdx(mapping.duration);
    const inIdx = getIdx(mapping.intake);
    const eIdx = getIdx(mapping.entry);
    const engIdx = getIdx(mapping.english);
    const urlIdx = getIdx(mapping.url);

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
      let minDegree = justPassCutoff ? 35 : countryMinPercent;
      if (!justPassCutoff && !overrideExcelPercent) {
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

      // Capture exact original Excel headings and values for 1:1 Excel download
      const rawExcelRow: Record<string, any> = {};
      headers.forEach((h, cIndex) => {
        if (h && row[cIndex] !== undefined && row[cIndex] !== '') {
          rawExcelRow[h] = typeof row[cIndex] === 'string'
            ? row[cIndex].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
            : row[cIndex];
        } else if (h) {
          rawExcelRow[h] = '';
        }
      });

      const rowUni = uIdx !== -1 ? String(row[uIdx] || '').replace(/[\r\n]+/g, ' ').trim() : '';
      const rowCountry = ctryIdx !== -1 ? String(row[ctryIdx] || '').replace(/[\r\n]+/g, ' ').trim() : '';
      const rowIntake = inIdx !== -1 ? String(row[inIdx] || '').replace(/[\r\n]+/g, ' ').trim() : '';
      const rowUrl = urlIdx !== -1 ? String(row[urlIdx] || '').trim() : '';
      const countryIntel = getCountryVisaIntel(rowCountry || selectedCountry, degreeLevel);

      parsed.push({
        id: `row-${idx}`,
        university: rowUni || selectedUniversity,
        country: rowCountry || selectedCountry,
        program_name: cleanTitle,
        degree_level: degreeLevel,
        category: category,
        duration_months: durationMonths,
        tuition_fees_eur: fee,
        intake: rowIntake || 'September, February',
        stay_back_visa_years: countryIntel.stayBackYears,
        average_graduate_salary: countryIntel.avgSalaryEur,
        min_degree_percent: minDegree,
        min_12th_percent: minDegree,
        min_ielts: minIelts,
        interview_required: cleanTitle.toLowerCase().includes('interview'),
        english_policy: effectivePolicy,
        course_url: rowUrl || 'https://study-abroad.edu',
        raw_excel_data: rawExcelRow,
      });
    });

    setPreviewRows(parsed);
  };

  const applyColumnMapping = (
    newColName: string,
    type: 'course' | 'university' | 'country' | 'tuition' | 'level' | 'duration' | 'intake' | 'entry' | 'english' | 'url'
  ) => {
    const updated = {
      course: type === 'course' ? newColName : courseCol,
      university: type === 'university' ? newColName : universityCol,
      country: type === 'country' ? newColName : countryCol,
      tuition: type === 'tuition' ? newColName : tuitionCol,
      level: type === 'level' ? newColName : levelCol,
      duration: type === 'duration' ? newColName : durationCol,
      intake: type === 'intake' ? newColName : intakeCol,
      entry: type === 'entry' ? newColName : entryReqCol,
      english: type === 'english' ? newColName : englishCol,
      url: type === 'url' ? newColName : urlCol,
    };
    if (type === 'course') setCourseCol(newColName);
    if (type === 'university') setUniversityCol(newColName);
    if (type === 'country') setCountryCol(newColName);
    if (type === 'tuition') setTuitionCol(newColName);
    if (type === 'level') setLevelCol(newColName);
    if (type === 'duration') setDurationCol(newColName);
    if (type === 'intake') setIntakeCol(newColName);
    if (type === 'entry') setEntryReqCol(newColName);
    if (type === 'english') setEnglishCol(newColName);
    if (type === 'url') setUrlCol(newColName);

    generatePreviewWithMapping(sheetRawData, headerIndex, availableColumns, updated);
  };

  const handleCommitUpload = async () => {
    if (previewRows.length === 0) return;
    setCommitting(true);
    setCommitProgress(null);
    setCommitSuccess(null);
    setExcelError(null);

    const customExtras: Record<string, string> = {};
    customFields.forEach((cf) => {
      if (cf.key.trim() && cf.value.trim()) {
        customExtras[cf.key.trim()] = cf.value.trim();
      }
    });

    const excludedSet = new Set(excludedCols);
    const rowsToCommit = previewRows.map((r) => {
      const filteredRaw: Record<string, any> = {};
      Object.entries(r.raw_excel_data || {}).forEach(([k, v]) => {
        if (!excludedSet.has(k)) filteredRaw[k] = v;
      });
      return {
        ...r,
        university: (r.university || selectedUniversity || '').trim(),
        country: (r.country || selectedCountry || '').trim(),
        stay_back_visa_years: r.stay_back_visa_years || selectedStayBack,
        raw_excel_data: {
          ...filteredRaw,
          ...customExtras,
        },
      };
    });

    if (rowsToCommit.some((r) => !r.country)) {
      setExcelError('Missing Country: please select a Country in Step 1 OR map the "Country" column in Step 3 before saving.');
      setCommitting(false);
      return;
    }

    if (rowsToCommit.some((r) => !r.university)) {
      setExcelError('Missing University Name: please enter a University Name in Step 1 OR map the "University" column in Step 3 before saving.');
      setCommitting(false);
      return;
    }

    // Auto-fetch AI stay-back & salary intelligence for any brand-new country not in built-in table
    const uniqueNewCountries = Array.from(
      new Set(rowsToCommit.map((r) => r.country).filter((c) => c && !hasBuiltInCountryGuide(c)))
    );
    if (uniqueNewCountries.length > 0) {
      try {
        setCommitProgress(`Fetching AI stay-back & visa rules for ${uniqueNewCountries[0]}...`);
        const intelMap = new Map<string, any>();
        await Promise.all(
          uniqueNewCountries.slice(0, 5).map(async (c) => {
            const res = await fetch(`/api/country-intel?country=${encodeURIComponent(c)}`);
            const data = await res.json();
            if (data.success) intelMap.set(c.toLowerCase(), data);
          })
        );
        rowsToCommit.forEach((r) => {
          const intel = intelMap.get(r.country.toLowerCase());
          if (intel) {
            const isUg =
              r.degree_level.toLowerCase().includes('bachelor') ||
              r.degree_level.toLowerCase().includes('ug') ||
              r.degree_level.toLowerCase().includes('certificate');
            r.stay_back_visa_years = isUg
              ? Number(intel.bachelorStayBackYears) || Number(intel.stayBackYears) || r.stay_back_visa_years
              : Number(intel.masterStayBackYears || intel.stayBackYears) || r.stay_back_visa_years;
            r.average_graduate_salary = Number(intel.avgSalaryEur) || r.average_graduate_salary;
          }
        });
      } catch {
        // Non-fatal: proceed with fallback values
      }
    }

    const CHUNK_SIZE = 300;
    let totalInserted = 0;

    try {
      for (let i = 0; i < rowsToCommit.length; i += CHUNK_SIZE) {
        const chunk = rowsToCommit.slice(i, i + CHUNK_SIZE);
        setCommitProgress(`Saving ${Math.min(i + chunk.length, rowsToCommit.length).toLocaleString()} / ${rowsToCommit.length.toLocaleString()}...`);

        let data: any = null;
        let lastErr = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch('/api/ingest-excel/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows: chunk }),
            });
            data = await res.json();
            if (res.ok && data.success) break;
            lastErr = data?.error || `HTTP ${res.status}`;
          } catch (netErr: any) {
            lastErr = netErr?.message || 'Network error';
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        }

        if (!data || !data.success) {
          throw new Error(lastErr || `Batch starting at row ${i + 1} failed`);
        }
        totalInserted += data.inserted_count ?? 0;
      }

      const uniqueUnisCount = new Set(rowsToCommit.map((r) => r.university)).size;
      setCommitSuccess(
        uniqueUnisCount > 1
          ? `Successfully saved ${totalInserted.toLocaleString()} courses across ${uniqueUnisCount} institutions!`
          : `Successfully saved ${totalInserted.toLocaleString()} courses under "${rowsToCommit[0]?.university || selectedUniversity}" (${rowsToCommit[0]?.country || selectedCountry})!`
      );
      setPreviewRows([]);
      setExcelFile(null);
      setAvailableColumns([]);
      try {
        sessionStorage.removeItem('globalcourse_cache_v1');
      } catch {
        // Ignore storage errors
      }
    } catch (err: any) {
      setExcelError(
        totalInserted > 0
          ? `Saved ${totalInserted.toLocaleString()} courses before interruption: ${err.message}`
          : err.message || 'Network error while committing'
      );
    } finally {
      setCommitting(false);
      setCommitProgress(null);
    }
  };

  const handleHesaDualImport = async () => {
    if (!hesaInstFile || !hesaCourseFile) return;
    setParsingHesa(true);
    setSyncMessage(null);
    setExcelError(null);
    setCommitSuccess(null);

    try {
      const [instBuf, courseBuf] = await Promise.all([
        hesaInstFile.arrayBuffer(),
        hesaCourseFile.arrayBuffer(),
      ]);

      const instWb = XLSX.read(instBuf, { type: 'buffer' });
      const instRows: any[] = XLSX.utils.sheet_to_json(instWb.Sheets[instWb.SheetNames[0]]);
      const uniByPubUkprn = new Map<string, string>();
      instRows.forEach((r) => {
        const name = String(r.LEGAL_NAME || r.FIRST_TRADING_NAME || r.OTHER_NAME || '').trim();
        if (!name) return;
        const pubUkprn = String(r.PUBUKPRN || '').trim();
        const ukprn = String(r.UKPRN || '').trim();
        if (pubUkprn) uniByPubUkprn.set(pubUkprn, name);
        if (ukprn && !uniByPubUkprn.has(ukprn) && (!pubUkprn || pubUkprn === ukprn)) {
          uniByPubUkprn.set(ukprn, name);
        }
      });

      const courseWb = XLSX.read(courseBuf, { type: 'buffer' });
      const courseRows: any[] = XLSX.utils.sheet_to_json(courseWb.Sheets[courseWb.SheetNames[0]]);

      const seen = new Set<string>();
      const parsed: ParsedPreviewRow[] = [];

      courseRows.forEach((r, idx) => {
        const title = String(r.TITLE || r.TITLEW || '').trim();
        const pubUkprn = String(r.PUBUKPRN || r.UKPRN || '').trim();
        const uniName = uniByPubUkprn.get(pubUkprn) || uniByPubUkprn.get(String(r.UKPRN || '').trim());
        if (!title || !uniName) return;

        const dedupeKey = `${pubUkprn}::${title.toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const lower = title.toLowerCase();
        let category = 'Business & Management';
        if (lower.includes('comput') || lower.includes('ai') || lower.includes('software') || lower.includes('cyber')) {
          category = 'Computer Science & AI';
        } else if (lower.includes('data') || lower.includes('analytics')) {
          category = 'Data Science';
        } else if (lower.includes('engineer') || lower.includes('mechanical') || lower.includes('civil') || lower.includes('aerospace')) {
          category = 'Engineering';
        }

        const degreeLevel = String(r.FOUNDAT) === '1' && String(r.HONOURS) !== '1' ? 'UG Diploma' : 'Bachelor';
        const stages = Number(r.NUMSTAGE);
        const durationMonths = !Number.isNaN(stages) && stages > 0 ? stages * 12 : 36;

        const minPct = justPassCutoff ? 35 : countryMinPercent || 55;
        const minIeltsVal =
          countryEnglishPolicy === 'MOI_ACCEPTED'
            ? 5.5
            : countryEnglishPolicy === 'WAIVED' || countryEnglishPolicy === 'NO_REQUIREMENT'
            ? 0
            : 6.0;

        parsed.push({
          id: `hesa-${idx}`,
          university: uniName,
          country: 'United Kingdom',
          program_name: title,
          degree_level: degreeLevel,
          category,
          duration_months: durationMonths,
          tuition_fees_eur: 16500,
          intake: 'September',
          stay_back_visa_years: 2.0,
          average_graduate_salary: 38000,
          min_degree_percent: minPct,
          min_12th_percent: minPct,
          min_ielts: minIeltsVal,
          interview_required: false,
          english_policy: countryEnglishPolicy,
          course_url: String(r.CRSEURL || r.CRSECSTURL || 'https://discoveruni.gov.uk').trim(),
          raw_excel_data: {
            'UK University': uniName,
            PUBUKPRN: pubUkprn,
            'Course Title': title,
            'Course URL': r.CRSEURL || '',
            'Duration (Years)': r.NUMSTAGE || '3',
            'International Tuition': 'Check University Website (Est. ~€16,500/yr)',
          },
        });
      });

      if (parsed.length === 0) {
        setExcelError('No matching UK courses found. Make sure you selected INSTITUTION.csv and KISCOURSE.csv.');
        return;
      }

      setPreviewRows(parsed);
      const uniqueMatchedUnis = new Set(parsed.map((p) => p.university)).size;
      setSyncMessage(`Matched ${parsed.length.toLocaleString()} unique UK courses across ${uniqueMatchedUnis} UK institutions! Review Step 4 below & click Confirm & Save All.`);
    } catch (err: any) {
      setExcelError(`Error parsing HESA CSV files: ${err.message}`);
    } finally {
      setParsingHesa(false);
    }
  };

  const handleAiEnrichPreview = async () => {
    if (previewRows.length === 0) return;
    setEnrichingAi(true);
    setAiEnrichSummary(null);
    setExcelError(null);

    try {
      const targetCountry = previewRows[0]?.country || selectedCountry || '';
      const unis = Array.from(new Set(previewRows.map((r) => r.university || selectedUniversity).filter(Boolean)));
      const res = await fetch('/api/ai-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: targetCountry, universities: unis }),
      });
      const data = await res.json();
      if (data.success) {
        const urlMap: Record<string, string> = data.universityUrls || {};
        setPreviewRows((prev) =>
          prev.map((row) => {
            const uName = row.university || selectedUniversity;
            const resolvedUrl =
              urlMap[uName] ||
              Object.entries(urlMap).find(([k]) => k.toLowerCase() === uName.toLowerCase())?.[1] ||
              row.course_url;
            const isUg =
              row.degree_level.toLowerCase().includes('bachelor') ||
              row.degree_level.toLowerCase().includes('ug') ||
              row.degree_level.toLowerCase().includes('certificate');
            const stayBackVal = isUg
              ? Number(data.bachelorStayBackYears) || Number(data.stayBackYears) || row.stay_back_visa_years
              : Number(data.stayBackYears) || row.stay_back_visa_years;
            return {
              ...row,
              stay_back_visa_years: stayBackVal,
              average_graduate_salary: Number(data.avgSalaryEur) || row.average_graduate_salary,
              course_url: resolvedUrl,
              raw_excel_data: {
                ...(row.raw_excel_data || {}),
                'Stay-Back Visa': stayBackVal < 1 ? `${Math.round(stayBackVal * 12)} Months` : `${stayBackVal} Years`,
                ...(data.visaSummary ? { 'AI Visa Policy Note': data.visaSummary } : {}),
              },
            };
          })
        );
        setAiEnrichSummary(
          `AI Enriched (${data.source}): ${data.stayBackYears}y Stay-Back • Avg Salary €${Number(data.avgSalaryEur).toLocaleString()} • ${Object.keys(urlMap).length} university websites matched. ${data.visaSummary || ''}`
        );
      }
    } catch (err: any) {
      setExcelError(err.message || 'AI enrichment failed');
    } finally {
      setEnrichingAi(false);
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
              <option value="">-- Select Country (Required unless in Excel) --</option>
              {GLOBAL_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> University Name (Optional for Multi-Uni Sheet)
            </label>
            <input
              type="text"
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              placeholder="Leave blank if Excel has University column"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Academic Cutoff (%)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer" title="Accept any passing grade (35% baseline)">
                  <input
                    type="checkbox"
                    checked={justPassCutoff}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setJustPassCutoff(checked);
                      if (checked) {
                        setCountryMinPercent(35);
                        setOverrideExcelPercent(true);
                        if (previewRows.length > 0) {
                          setPreviewRows((prev) =>
                            prev.map((r) => ({ ...r, min_degree_percent: 35, min_12th_percent: 35 }))
                          );
                        }
                      }
                    }}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                  <span>Just Pass</span>
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 cursor-pointer" title="Override Excel percentage with this number">
                  <input
                    type="checkbox"
                    checked={overrideExcelPercent}
                    onChange={(e) => setOverrideExcelPercent(e.target.checked)}
                    className="accent-cyan-600 rounded cursor-pointer"
                  />
                  <span>Apply All</span>
                </label>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={justPassCutoff}
                value={justPassCutoff ? 35 : countryMinPercent}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCountryMinPercent(val);
                  if (overrideExcelPercent && previewRows.length > 0) {
                    setPreviewRows((prev) =>
                      prev.map((r) => ({ ...r, min_degree_percent: val, min_12th_percent: val }))
                    );
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-cyan-500 font-bold disabled:opacity-65"
              />
              <span className="absolute right-3.5 top-2 text-xs text-slate-400">
                {justPassCutoff ? 'Just Pass' : '%'}
              </span>
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
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    DAAD Germany (2,000+ Courses)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Syncs in fast 100-course batches
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {syncingMap.daad ? (
                    <button
                      onClick={() => {
                        stopSyncRef.current = true;
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-[10px] font-bold cursor-pointer"
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    onClick={runDaadFullSync}
                    disabled={syncingMap.daad}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingMap.daad ? 'animate-spin' : ''}`} />
                    {syncingMap.daad ? 'Syncing...' : 'Sync All DAAD'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    UK Direct University Website Sync (No Partner Portal Needed)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Fetch Masters/PG directly from any UK university&apos;s .ac.uk website
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={ukDirectUni}
                    onChange={(e) => setUkDirectUni(e.target.value)}
                    placeholder="e.g. University of East London"
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="url"
                    value={ukDirectUrl}
                    onChange={(e) => setUkDirectUrl(e.target.value)}
                    placeholder="Optional .ac.uk PG URL (https://...)"
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!ukDirectUni.trim() && !ukDirectUrl.trim()) return;
                    setSyncingMap((p) => ({ ...p, uk_direct: true }));
                    setSyncMessage(null);
                    setExcelError(null);
                    try {
                      const res = await fetch('/api/sync-uk-university', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          universityName: ukDirectUni.trim(),
                          websiteUrl: ukDirectUrl.trim(),
                          degreeLevel: 'Master',
                        }),
                      });
                      const data = await res.json();
                      if (data.success && Array.isArray(data.rows) && data.rows.length > 0) {
                        setPreviewRows(data.rows);
                        setSyncMessage(
                          `Loaded ${data.rows.length} UK Masters programmes for ${data.university} (${data.usedLiveHtml ? 'from live .ac.uk page' : 'from .ac.uk lookup'}) into Step 4 Preview!`
                        );
                      } else {
                        setSyncMessage(data.error || 'Could not extract UK university courses.');
                      }
                    } catch (err: any) {
                      setSyncMessage(err.message || 'UK sync error');
                    } finally {
                      setSyncingMap((p) => ({ ...p, uk_direct: false }));
                    }
                  }}
                  disabled={syncingMap.uk_direct || (!ukDirectUni.trim() && !ukDirectUrl.trim())}
                  className="w-full py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingMap.uk_direct ? 'animate-spin' : ''}`} />
                  {syncingMap.uk_direct ? 'Fetching Official .ac.uk Courses...' : 'Fetch UK Masters from Official Website'}
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Sync Any CSV / Google Sheet / JSON URL
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Paste a public .csv, .xlsx, .json, or Google Sheet CSV link
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    placeholder="https://.../courses.csv"
                    className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={async () => {
                      if (!feedUrl.trim()) return;
                      setSyncingMap((p) => ({ ...p, feed_url: true }));
                      setSyncMessage(null);
                      setExcelError(null);
                      try {
                        const res = await fetch('/api/sync-web', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ source: 'fetch_url', url: feedUrl.trim() }),
                        });
                        const data = await res.json();
                        if (data.success && Array.isArray(data.rawAoA)) {
                          processRawAoA(data.rawAoA);
                          setSyncMessage(`Loaded ${data.count?.toLocaleString() || ''} rows from URL into Step 4 Preview below — review & click Save All!`);
                        } else {
                          setSyncMessage(data.error || 'Could not load feed URL.');
                        }
                      } catch (err: any) {
                        setSyncMessage(err.message || 'URL fetch error');
                      } finally {
                        setSyncingMap((p) => ({ ...p, feed_url: false }));
                      }
                    }}
                    disabled={syncingMap.feed_url || !feedUrl.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingMap.feed_url ? 'animate-spin' : ''}`} />
                    {syncingMap.feed_url ? 'Loading...' : 'Fetch URL'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-600 dark:text-slate-400 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    UK Discover Uni (HESA) 2-File Importer
                  </span>
                  <a
                    href="https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-sky-400 font-semibold hover:underline shrink-0"
                  >
                    Download ZIP →
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="px-2 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 cursor-pointer truncate text-center">
                    {hesaInstFile ? `✓ ${hesaInstFile.name}` : '1. INSTITUTION.csv'}
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => e.target.files && setHesaInstFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <label className="px-2 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 cursor-pointer truncate text-center">
                    {hesaCourseFile ? `✓ ${hesaCourseFile.name}` : '2. KISCOURSE.csv'}
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => e.target.files && setHesaCourseFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
                <button
                  onClick={handleHesaDualImport}
                  disabled={!hesaInstFile || !hesaCourseFile || parsingHesa}
                  className="w-full py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 font-bold cursor-pointer disabled:opacity-40"
                >
                  {parsingHesa ? 'Matching UKPRN Universities...' : 'Match & Load All UK Courses'}
                </button>
              </div>
            </div>

            {syncMessage && (
              <div className="mt-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-700 dark:text-sky-300 font-medium">
                {syncMessage}
              </div>
            )}
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            {[
              { label: 'Course Title *', val: courseCol, key: 'course' as const, required: true },
              { label: 'University (Multi-Uni Sheet)', val: universityCol, key: 'university' as const, required: false },
              { label: 'Country (Optional)', val: countryCol, key: 'country' as const, required: false },
              { label: 'Tuition Fee', val: tuitionCol, key: 'tuition' as const, required: false },
              { label: 'MQF / Level', val: levelCol, key: 'level' as const, required: false },
              { label: 'Duration', val: durationCol, key: 'duration' as const, required: false },
              { label: 'Intake Months', val: intakeCol, key: 'intake' as const, required: false },
              { label: 'Entry Req (%)', val: entryReqCol, key: 'entry' as const, required: false },
              { label: 'English / IELTS', val: englishCol, key: 'english' as const, required: false },
              { label: 'Course URL', val: urlCol, key: 'url' as const, required: false },
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
                  {!item.required && <option value="">-- Use Step 1 Default / None --</option>}
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Extra Preserved Excel Columns + Custom Reusable Fields */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            {(() => {
              const mappedSet = new Set([
                courseCol,
                universityCol,
                countryCol,
                tuitionCol,
                levelCol,
                durationCol,
                intakeCol,
                entryReqCol,
                englishCol,
                urlCol,
              ].filter(Boolean));
              const extraCols = availableColumns.filter((c) => !mappedSet.has(c) && !excludedCols.includes(c));
              if (extraCols.length === 0 && excludedCols.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Extra Excel headings auto-saved (click × to remove for this upload only):
                  </span>
                  {extraCols.map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium"
                    >
                      {col}
                      <button
                        type="button"
                        onClick={() => setExcludedCols((prev) => [...prev, col])}
                        className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                        title={`Remove "${col}" from this upload only`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {excludedCols.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExcludedCols([])}
                      className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-semibold cursor-pointer"
                    >
                      Restore {excludedCols.length} removed
                    </button>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Add Custom Field to All Rows (e.g. Visa Process, Application Fee, Notes):
              </span>
              <input
                type="text"
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="Heading name (e.g. Visa Process)"
                className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white w-48"
              />
              <input
                type="text"
                value={newCustomVal}
                onChange={(e) => setNewCustomVal(e.target.value)}
                placeholder="Value (e.g. AIC + Embassy Interview)"
                className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white w-56"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCustomKey.trim() || !newCustomVal.trim()) return;
                  setCustomFields((prev) => [...prev, { key: newCustomKey.trim(), value: newCustomVal.trim() }]);
                  setNewCustomKey('');
                  setNewCustomVal('');
                }}
                className="px-3 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer"
              >
                + Add Custom Field
              </button>
            </div>

            {customFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {customFields.map((cf, idx) => (
                  <span
                    key={`${cf.key}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-medium"
                  >
                    <strong>{cf.key}:</strong> {cf.value}
                    <button
                      type="button"
                      onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                      title="Remove custom field"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
                {(() => {
                  const uniqueUnis = new Set(previewRows.map((r) => r.university).filter(Boolean));
                  if (uniqueUnis.size > 1) {
                    return (
                      <>
                        Will be saved across <strong className="text-cyan-700 dark:text-cyan-300">{uniqueUnis.size} institutions</strong> ({previewRows[0]?.country || selectedCountry}).
                      </>
                    );
                  }
                  return (
                    <>
                      Will be saved to <strong className="text-cyan-700 dark:text-cyan-300">{previewRows[0]?.university || selectedUniversity}</strong> ({previewRows[0]?.country || selectedCountry}).
                    </>
                  );
                })()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleAiEnrichPreview}
                disabled={enrichingAi || committing}
                className="px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Use AI to update stay-back visa years, graduate salary, and real university websites"
              >
                <Sparkles className={`w-3.5 h-3.5 ${enrichingAi ? 'animate-spin' : ''}`} />
                {enrichingAi ? 'AI Enriching...' : 'AI Auto-Enrich (Stay-Back & Websites)'}
              </button>
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
                {committing ? (commitProgress || 'Saving...') : `Confirm & Save All ${previewRows.length.toLocaleString()} Courses`}
              </button>
            </div>
          </div>

          {aiEnrichSummary && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs font-medium text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{aiEnrichSummary}</span>
            </div>
          )}

          {previewRows.length > 100 && (
            <p className="text-[11px] text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
              Showing first 100 rows in preview for speed — all <strong>{previewRows.length.toLocaleString()}</strong> courses will be uploaded in fast 300-row batches.
            </p>
          )}

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
                {previewRows.slice(0, 100).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 max-w-sm">
                      <span className="font-semibold text-slate-900 dark:text-white block">{row.program_name}</span>
                      <span className="text-[11px] text-cyan-700 dark:text-cyan-400 font-medium block mt-0.5">
                        {row.university} • {row.country}
                      </span>
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
                      <div className="flex items-center gap-1.5">
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
                        {justPassCutoff && row.min_degree_percent <= 35 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            Just Pass
                          </span>
                        )}
                      </div>
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
