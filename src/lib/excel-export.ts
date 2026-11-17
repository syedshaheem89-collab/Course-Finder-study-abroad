import * as XLSX from 'xlsx';
import { Course } from '@/types/database';
import { normalizeCourseType } from './course-utils';

export type CourseWithMatch = Course & { matchScore?: number };

/**
 * Exports one or more courses into a formatted .xlsx Excel workbook.
 * If courses were uploaded from Excel with original headings (raw_excel_data),
 * preserves every exact original Excel heading and value, while also including
 * updated website fields (University, Country, Min Degree %, Min 12th %, Match Fit %).
 */
export function exportCoursesToExcel(
  courses: CourseWithMatch[],
  filenamePrefix = 'courses-export',
  includeMatchScore = false
) {
  if (!courses || courses.length === 0) return;

  const rows = courses.map((course) => {
    const raw = course.raw_excel_data && typeof course.raw_excel_data === 'object'
      ? course.raw_excel_data
      : null;

    if (raw && Object.keys(raw).length > 0) {
      // Preserve exact original Excel headings & values first
      const exactRow: Record<string, string | number> = {
        ...raw,
      };

      // Append updated website / eligibility info if not already present
      if (!('University' in exactRow)) exactRow['University'] = course.university?.name || '';
      if (!('Country' in exactRow)) exactRow['Country'] = course.university?.country || '';
      exactRow['Updated Min +2 / 12th (%)'] = course.eligibility_rules?.min_12th_percent ?? 50;
      exactRow['Updated Min Degree (%)'] = course.eligibility_rules?.min_degree_percent ?? 50;
      exactRow['Updated Tuition (EUR)'] = course.tuition_fees_eur;
      if (includeMatchScore && course.matchScore !== undefined) {
        exactRow['Match Fit (%)'] = `${course.matchScore}%`;
      }
      return exactRow;
    }

    // Standard fallback for non-Excel / seed courses
    const base: Record<string, string | number> = {
      'Program Name': course.program_name,
      'Course Type': normalizeCourseType(course),
      'University': course.university?.name || '',
      'Country': course.university?.country || '',
      'Global Ranking (QS)': course.university?.global_ranking || '',
      'Subject / Category': course.category || '',
      'Duration (Months)': course.duration_months,
      'Tuition Fees (EUR)': course.tuition_fees_eur,
      'Intakes': Array.isArray(course.intake_months)
        ? course.intake_months.join(', ')
        : course.intake_months || '',
      'Stay Back Visa (Years)': course.stay_back_visa_years,
      'Avg Graduate Salary (EUR)': course.average_graduate_salary,
      'Min +2 / 12th (%)': course.eligibility_rules?.min_12th_percent ?? 50,
      'Min Degree (%)': course.eligibility_rules?.min_degree_percent ?? 50,
      'Min IELTS': course.eligibility_rules?.min_ielts ?? 6.0,
      'English Policy':
        course.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
          ? 'MOI Accepted'
          : course.eligibility_rules?.english_requirement_type === 'WAIVED'
          ? 'English Waived'
          : course.eligibility_rules?.english_requirement_type === 'NO_REQUIREMENT'
          ? 'No Requirement'
          : 'IELTS / TOEFL',
      'Interview Required': course.eligibility_rules?.interview_required ? 'Yes' : 'No',
      'Official Website URL': course.course_url || '',
    };

    if (includeMatchScore && course.matchScore !== undefined) {
      base['Match Fit (%)'] = `${course.matchScore}%`;
    }

    return base;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Dynamically compute column widths from headers
  const allKeys = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
  worksheet['!cols'] = Array.from(allKeys).map((k) => ({
    wch: Math.min(48, Math.max(16, k.length + 6)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Courses');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${dateStr}.xlsx`);
}
