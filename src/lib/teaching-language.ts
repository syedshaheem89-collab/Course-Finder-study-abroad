export const TEACHING_LANGUAGES = [
  'English',
  'Italian',
  'German',
  'Polish',
  'French',
  'Spanish',
  'Dutch',
  'Swedish',
  'Japanese',
  'Korean',
  'Bilingual',
] as const;

export type TeachingLanguageOption = (typeof TEACHING_LANGUAGES)[number];

export interface CourseTeachingLanguageInfo {
  language: TeachingLanguageOption;
  displayLabel: string;
  proficiencyRequired?: string;
  isLocalLanguageRequired: boolean;
  source: 'verified' | 'excel' | 'title' | 'rule';
}

const LANGUAGE_ALIASES: Array<{ re: RegExp; lang: TeachingLanguageOption }> = [
  { re: /\b(?:bilingual|dual\s+language)\b/i, lang: 'Bilingual' },
  { re: /\b(?:english|inglese|englisch|angielski|anglais|ingl[eé]s)\b/i, lang: 'English' },
  { re: /\b(?:italian|italiano|italienisch)\b/i, lang: 'Italian' },
  { re: /\b(?:german|deutsch|tedesco|niemiecki|allemand)\b/i, lang: 'German' },
  { re: /\b(?:polish|polski|polacco|polnisch)\b/i, lang: 'Polish' },
  { re: /\b(?:french|fran[cç]ais|francese|franz[oö]sisch)\b/i, lang: 'French' },
  { re: /\b(?:spanish|espa[nñ]ol|spagnolo|spanisch)\b/i, lang: 'Spanish' },
  { re: /\b(?:dutch|nederlands|olandese|niederl[aä]ndisch)\b/i, lang: 'Dutch' },
  { re: /\b(?:swedish|svenska|schwedisch|svedese)\b/i, lang: 'Swedish' },
  { re: /\b(?:japanese|nihongo|giapponese|japanisch)\b/i, lang: 'Japanese' },
  { re: /\b(?:korean|hangul|coreano|koreanisch)\b/i, lang: 'Korean' },
];

export function normalizeTeachingLanguage(raw?: string | null): TeachingLanguageOption | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/\bbilingual\b|\bdual\s+language\b/i.test(s)) return 'Bilingual';

  const matchedLangs: TeachingLanguageOption[] = [];
  for (const { re, lang } of LANGUAGE_ALIASES) {
    if (lang === 'Bilingual') continue;
    if (re.test(s)) matchedLangs.push(lang);
  }
  if (matchedLangs.length >= 2) return 'Bilingual';
  if (matchedLangs.length === 1) return matchedLangs[0];
  return null;
}

export function extractLanguageProficiency(raw?: string | null): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  const langCeq = s.match(
    /\b(German|Italian|Polish|French|Spanish|Dutch|Swedish)\s+(A2|B1|B2|C1|C2)\b/i
  );
  if (langCeq) {
    const lang = langCeq[1].charAt(0).toUpperCase() + langCeq[1].slice(1).toLowerCase();
    return `${lang} ${langCeq[2].toUpperCase()}`;
  }

  const testdafDsh = s.match(/\b(TestDaF\s*[345](?:\s*\/\s*DSH[- ]?[123])?|DSH[- ]?[123]|Goethe[- ]?(?:Zertifikat\s*)?[ABC][12]|CILS\s*[ABC][12]|CELI\s*[1-5]|DELF\s*[AB][12]|DALF\s*C[12]|DELE\s*[ABC][12]|JLPT\s*N[1-5]|Japanese\s*N[1-5]|TOPIK\s*(?:Level\s*)?[1-6])\b/i);
  if (testdafDsh) {
    return testdafDsh[1].replace(/\s+/g, ' ').trim();
  }

  const bareLevel = s.match(/\b([BC][12])\b/);
  const normLang = normalizeTeachingLanguage(s);
  if (bareLevel && normLang && normLang !== 'English' && normLang !== 'Bilingual') {
    return `${normLang} ${bareLevel[1].toUpperCase()}`;
  }

  return null;
}

function buildDisplayLabel(
  language: TeachingLanguageOption,
  proficiencyRequired?: string
): string {
  if (language === 'English') return 'English';
  if (proficiencyRequired) {
    const lvlOnly = proficiencyRequired.replace(
      new RegExp(`^${language}\\s+`, 'i'),
      ''
    );
    return `${language} (${lvlOnly} Required)`;
  }
  if (language === 'Bilingual') return 'Bilingual (English + Local)';
  return `${language} (Required)`;
}

export function resolveCourseTeachingLanguage(course: {
  program_name?: string | null;
  category?: string | null;
  course_url?: string | null;
  university?: { name?: string | null; country?: string | null } | null;
  verified_meta?: {
    teachingLanguage?: string | null;
    languageProficiency?: string | null;
  } | null;
  raw_excel_data?: Record<string, any> | null;
}): CourseTeachingLanguageInfo {
  // 1. Live verified metadata (highest trust)
  const verifiedLang = normalizeTeachingLanguage(course.verified_meta?.teachingLanguage);
  if (verifiedLang) {
    const prof =
      (course.verified_meta?.languageProficiency || '').trim() ||
      extractLanguageProficiency(course.verified_meta?.teachingLanguage) ||
      undefined;
    return {
      language: verifiedLang,
      proficiencyRequired: prof,
      displayLabel: buildDisplayLabel(verifiedLang, prof),
      isLocalLanguageRequired: verifiedLang !== 'English',
      source: 'verified',
    };
  }

  // 2. Excel metadata inspection
  if (course.raw_excel_data && typeof course.raw_excel_data === 'object') {
    let rawLangVal = '';
    let rawProfVal = '';
    for (const [k, v] of Object.entries(course.raw_excel_data)) {
      if (typeof v !== 'string' || !v.trim()) continue;
      if (/language|medium|instruction|taught|deutsch|italiano|polski/i.test(k)) {
        rawLangVal = `${rawLangVal} ${v}`.trim();
      }
      if (/proficiency|cefr|level|b2|c1|dsh|testdaf|cils|topik|jlpt/i.test(k)) {
        rawProfVal = `${rawProfVal} ${v}`.trim();
      }
    }
    const excelLang = normalizeTeachingLanguage(rawLangVal);
    if (excelLang) {
      const prof =
        extractLanguageProficiency(rawProfVal) ||
        extractLanguageProficiency(rawLangVal) ||
        undefined;
      return {
        language: excelLang,
        proficiencyRequired: prof,
        displayLabel: buildDisplayLabel(excelLang, prof),
        isLocalLanguageRequired: excelLang !== 'English',
        source: 'excel',
      };
    }
  }

  const title = String(course.program_name || '').trim();
  const titleLower = title.toLowerCase();
  const urlLower = String(course.course_url || '').toLowerCase();
  const countryLower = String(course.university?.country || '').trim().toLowerCase();
  const hay = `${title} ${course.category || ''}`.toLowerCase();

  // 3. Explicit course title / URL cues
  const hasExplicitEnglish =
    /\benglish\b|\benglish\s+track\b|\btaught\s+in\s+english\b|\bimat\b/i.test(titleLower) ||
    /\/en\/|english-taught|taught-in-english/.test(urlLower);

  const explicitFromTitle = normalizeTeachingLanguage(titleLower);
  if (explicitFromTitle && explicitFromTitle !== 'English') {
    const prof = extractLanguageProficiency(title) || undefined;
    return {
      language: explicitFromTitle,
      proficiencyRequired: prof,
      displayLabel: buildDisplayLabel(explicitFromTitle, prof),
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (/\blaurea\b|\bcorso\s+di\s+laurea\b|\bingegneria\b|\bmedicina\b|\binfermieristica\b/i.test(titleLower) && !hasExplicitEnglish) {
    return {
      language: 'Italian',
      proficiencyRequired: 'Italian B2',
      displayLabel: 'Italian (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (/\b(?:auf\s+deutsch|pflege|krankenpflege|medizin|rechtswissenschaft|bwl|vwl|lehramt)\b/i.test(titleLower) && !hasExplicitEnglish) {
    return {
      language: 'German',
      proficiencyRequired: 'German B2',
      displayLabel: 'German (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (/\b(?:po\s+polsku|piel[eę]gniarstwo|lekarski)\b/i.test(titleLower) && !hasExplicitEnglish) {
    return {
      language: 'Polish',
      proficiencyRequired: 'Polish B2',
      displayLabel: 'Polish (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (/\b(?:en\s+fran[cç]ais|licence\b|soins\s+infirmiers)\b/i.test(titleLower) && !hasExplicitEnglish) {
    return {
      language: 'French',
      proficiencyRequired: 'French B2',
      displayLabel: 'French (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (/\b(?:en\s+espa[nñ]ol|grado\s+en|enfermer[ií]a)\b/i.test(titleLower) && !hasExplicitEnglish) {
    return {
      language: 'Spanish',
      proficiencyRequired: 'Spanish B2',
      displayLabel: 'Spanish (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'title',
    };
  }

  if (hasExplicitEnglish) {
    return {
      language: 'English',
      displayLabel: 'English',
      isLocalLanguageRequired: false,
      source: 'title',
    };
  }

  // 4. Country clinical / state-regulated degree rules (when English track is not specified)
  const isNursingRehab = /\b(?:nursing|nurse|bsn|bscn|midwifery|physiotherapy)\b/.test(hay);
  const isClinicalMed = /\b(?:medicine|medical\s+doctor|mbbs|dentistry|dental|pharmacy|veterinary)\b/.test(hay);

  if (['austria', 'germany', 'switzerland'].includes(countryLower)) {
    if (isNursingRehab) {
      return {
        language: 'German',
        proficiencyRequired: 'German B2',
        displayLabel: 'German (B2 Required)',
        isLocalLanguageRequired: true,
        source: 'rule',
      };
    }
    if (isClinicalMed) {
      return {
        language: 'German',
        proficiencyRequired: 'German C1',
        displayLabel: 'German (C1 Required)',
        isLocalLanguageRequired: true,
        source: 'rule',
      };
    }
  }

  if (countryLower === 'italy') {
    if (isNursingRehab || isClinicalMed || /\blaw\b/.test(hay)) {
      return {
        language: 'Italian',
        proficiencyRequired: 'Italian B2',
        displayLabel: 'Italian (B2 Required)',
        isLocalLanguageRequired: true,
        source: 'rule',
      };
    }
  }

  if (countryLower === 'poland' && isNursingRehab) {
    return {
      language: 'Polish',
      proficiencyRequired: 'Polish B2',
      displayLabel: 'Polish (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'france' && (isNursingRehab || isClinicalMed)) {
    return {
      language: 'French',
      proficiencyRequired: 'French B2',
      displayLabel: 'French (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'spain' && (isNursingRehab || isClinicalMed)) {
    return {
      language: 'Spanish',
      proficiencyRequired: 'Spanish B2',
      displayLabel: 'Spanish (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'netherlands' && (isNursingRehab || /\bmedicine\b/.test(hay))) {
    return {
      language: 'Dutch',
      proficiencyRequired: 'Dutch B2',
      displayLabel: 'Dutch (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'sweden' && isNursingRehab) {
    return {
      language: 'Swedish',
      proficiencyRequired: 'Swedish B2',
      displayLabel: 'Swedish (B2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'japan' && (isNursingRehab || isClinicalMed)) {
    return {
      language: 'Japanese',
      proficiencyRequired: 'Japanese N2',
      displayLabel: 'Japanese (N2 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  if (countryLower === 'south korea' && (isNursingRehab || isClinicalMed)) {
    return {
      language: 'Korean',
      proficiencyRequired: 'TOPIK 3',
      displayLabel: 'Korean (TOPIK 3 Required)',
      isLocalLanguageRequired: true,
      source: 'rule',
    };
  }

  return {
    language: 'English',
    displayLabel: 'English',
    isLocalLanguageRequired: false,
    source: 'rule',
  };
}

export function matchesTeachingLanguageFilter(
  course: Parameters<typeof resolveCourseTeachingLanguage>[0],
  filter?: string | null
): boolean {
  const cleanFilter = String(filter || '').trim();
  if (!cleanFilter || cleanFilter.toLowerCase() === 'all') return true;
  const normalizedFilter = normalizeTeachingLanguage(cleanFilter) || (cleanFilter as TeachingLanguageOption);

  const info = resolveCourseTeachingLanguage(course);
  if (normalizedFilter === 'Bilingual') {
    return info.language === 'Bilingual';
  }
  if (info.language === normalizedFilter) return true;
  if (info.language === 'Bilingual') {
    if (normalizedFilter === 'English') return true;
    const rawCombo = `${course.program_name || ''} ${course.verified_meta?.teachingLanguage || ''} ${info.proficiencyRequired || ''}`;
    if (new RegExp(`\\b${normalizedFilter}\\b`, 'i').test(rawCombo)) return true;
  }
  return false;
}
