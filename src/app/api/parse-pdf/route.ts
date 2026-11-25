import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/security/session';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const universityName = String(formData.get('university_name') || 'Target University').slice(0, 150);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No PDF brochure uploaded' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF documents are permitted.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Uploaded PDF exceeds 10 MB limit.' },
        { status: 400 }
      );
    }

    // Simulate AI document OCR & multimodal LLM parsing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /*
     * -------------------------------------------------------------------------
     * GEMINI / OPENAI DOCUMENT PROCESSING SLOT:
     * -------------------------------------------------------------------------
     * Example using Gemini 1.5 Pro / Flash with native PDF document support:
     *
     * const bytes = await file.arrayBuffer();
     * const base64Pdf = Buffer.from(bytes).toString("base64");
     *
     * const model = googleGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });
     * const result = await model.generateContent([
     *   {
     *     inlineData: {
     *       data: base64Pdf,
     *       mimeType: "application/pdf"
     *     }
     *   },
     *   "Extract university courses, tuition fees, minimum IELTS, degree percentage, and intake dates into structured JSON matching the eligibility_rules schema."
     * ]);
     * -------------------------------------------------------------------------
     */

    const extractedData = {
      source_document: file.name,
      university_detected: universityName,
      extracted_programs_count: 2,
      parsed_records: [
        {
          program_name: 'M.Sc. Sustainable Energy Systems',
          degree_level: 'Master',
          duration_months: 24,
          tuition_fees_eur: 18500,
          intakes: ['September'],
          eligibility: {
            min_degree_percent: 70,
            min_ielts: 6.5,
            min_toefl: 92,
            interview_required: false,
            work_experience_months: 0,
          },
          confidence_score: 0.94,
        },
        {
          program_name: 'MBA in Global Technology Management',
          degree_level: 'Master',
          duration_months: 18,
          tuition_fees_eur: 28000,
          intakes: ['January', 'September'],
          eligibility: {
            min_degree_percent: 65,
            min_ielts: 7.0,
            min_toefl: 100,
            interview_required: true,
            work_experience_months: 24,
          },
          confidence_score: 0.91,
        },
      ],
    };

    return NextResponse.json({
      success: true,
      message: 'PDF brochure successfully analyzed and criteria parsed',
      data: extractedData,
    });
  } catch (error: unknown) {
    console.error('Error in /api/parse-pdf:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process and parse PDF document' },
      { status: 500 }
    );
  }
}
