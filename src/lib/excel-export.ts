import * as XLSX from 'xlsx';
import { Course } from '@/types/database';
import { normalizeCourseType } from './course-utils';

export type CourseWithMatch = Course & { matchScore?: number };

/**
 * Exports one or more courses (with all website, eligibility, and university details)
 * into a clean, formatted .xlsx Excel workbook download.
 */
export function exportCoursesToExcel(
  courses: CourseWithMatch[],
  filenamePrefix = 'courses-export',
  includeMatchScore = false
) {
  if (!courses || courses.length === 0) return;

  const rows = courses.map((course) => {
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

  // Set clean column widths for readability
  worksheet['!cols'] = [
    { wch: 45 }, // Program Name
    { wch: 16 }, // Course Type
    { wch: 38 }, // University
    { wch: 14 }, // Country
    { wch: 16 }, // Ranking
    { wch: 24 }, // Category
    { wch: 16 }, // Duration
    { wch: 18 }, // Tuition
    { wch: 20 }, // Intakes
    { wch: 20 }, // Stay Back
    { wch: 22 }, // Avg Salary
    { wch: 16 }, // Min 12th
    { wch: 16 }, // Min Degree
    { wch: 12 }, // Min IELTS
    { wch: 18 }, // English Policy
    { wch: 16 }, // Interview
    { wch: 40 }, // URL
    ...(includeMatchScore ? [{ wch: 14 }] : []),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Courses');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${dateStr}.xlsx`);
}
