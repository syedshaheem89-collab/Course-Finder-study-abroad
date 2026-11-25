import { normalizeCountryName } from './countries';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://course-finder-study-abroad.vercel.app'
).replace(/\/+$/, '');

export const DEFAULT_BRAND_NAME = 'Course Engine';

export interface DestinationFaq {
  question: string;
  answer: string;
}

export interface DestinationGuide {
  slug: string;
  country: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  editorialOverview: string[];
  publicVsPrivateSummary: string;
  englishAndMoiPolicy: string;
  topSubjects: string[];
  featuredUniversities: { name: string; sector: 'Public' | 'Private' }[];
  faqs: DestinationFaq[];
}

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Filter by country, sector, and budget.',
    description:
      'Search thousands of accredited Bachelor, Master, MBA, and Diploma programmes. Narrow down by Public or Private universities, tuition ceiling in EUR or INR, and MOI acceptance.',
  },
  {
    step: '02',
    title: 'Match your marks against live cutoffs.',
    description:
      'Enter your 12th, Bachelor percentage, backlogs, and IELTS/PTE/MOI background once to see realistic eligibility match scores and admission chances across your chosen destination.',
  },
  {
    step: '03',
    title: 'Verify 2026 stay-back and show-money proof.',
    description:
      'Review official 2026 post-study work durations, blocked account or bank-statement requirements, and export your shortlisted universities cleanly to Excel (.xlsx).',
  },
] as const;

export const HOMEPAGE_FAQS: DestinationFaq[] = [
  {
    question: 'How does the study abroad eligibility match score work?',
    answer:
      'Our matcher evaluates your academic percentages (+2 and Bachelor scores), backlog history, study gap, English proficiency (IELTS, PTE, TOEFL, or Medium of Instruction waiver), and annual tuition budget in EUR against programme entry criteria to classify fit into High, Good, or Stretch.',
  },
  {
    question: 'Which European countries offer free or low-tuition Public universities?',
    answer:
      'Germany offers tuition-free Public university degrees across most federal states (typically only €150–€350 semester contributions). Poland, Italy, France, Austria, and Norway also offer low-tuition English-taught Public university programmes starting between €0 and €4,500 per year.',
  },
  {
    question: 'Does Sweden offer a 2-year post-study stay-back visa?',
    answer:
      'No. Under 2026 Migrationsverket regulations, Bachelor and Master graduates in Sweden receive a 12-month (1 year) post-study residence permit to look for work or start a business. Longer 12–18 month permits apply only to PhD/doctoral graduates, alongside 2026 living funds proof of SEK 10,656/month.',
  },
  {
    question: 'Can I apply to foreign universities without IELTS using an MOI letter?',
    answer:
      'Yes. Several accredited universities in Malta, Poland, Ireland, Cyprus, Latvia, UK, and private European business schools accept a Medium of Instruction (MOI) certificate or internal English assessment when your prior Bachelor degree was taught completely in English.',
  },
  {
    question: 'What is the difference between Public and Private universities in the directory?',
    answer:
      'Public universities are state-funded research or applied sciences institutions that generally charge lower tuition and stricter academic cutoffs, while Private universities and business schools offer flexible intakes (January/February, May, September), smaller cohorts, and faster conditional offer letters.',
  },
  {
    question: 'Are 2026 show-money and post-study stay-back figures updated across every country?',
    answer:
      'Yes. Every course card, comparison table, Excel export, and AI recommendation normalizes post-study visa durations and 2026 maintenance proof against current national benchmarks including UK Graduate Route rules, German Sperrkonto (€11,904/yr), Dutch IND norms (€13,569/yr), and Canadian GIC limits (CAD 22,895/yr).',
  },
];

export const SEO_DESTINATION_GUIDES: DestinationGuide[] = [
  {
    slug: 'united-kingdom',
    country: 'United Kingdom',
    metaTitle: 'Study in the UK (2026) — Tuition & Graduate Visa',
    metaDescription:
      'Compare UK Public & Private universities, 1-year Masters, MOI waivers, £1,529/mo London maintenance rules, and 2026–2027 Graduate Route stay-back.',
    keywords: [
      'study in UK 2026',
      'UK 1 year masters',
      'UK Graduate Route 18 months',
      'UK MOI accepting universities',
      'UK student visa show money 2026',
    ],
    heroEyebrow: '2026 UK Study & Visa Guide',
    heroHeadline: 'Study in the United Kingdom.',
    heroSubheadline:
      'Fast-track 1-year Masters, globally ranked Public universities, flexible January & September intakes, and updated 2026 Graduate Route visa rules.',
    editorialOverview: [
      'The United Kingdom remains the top choice for career-focused international students seeking 12-month taught Master degrees and 3-year Honours Bachelor programmes. Completing an accredited degree in one academic year significantly lowers living overhead while accelerating return to full-time employment.',
      'Under official gov.uk rules, Graduate Route applications submitted on or before 31 December 2026 receive 2 years post-study stay-back, transitioning to a standard 18-month (1.5 years) stay-back for Bachelor and Master applications from 1 January 2027 (with 3 years retained for PhD graduates). Standard UKVI 28-day maintenance proof stands at £1,529/month inside London and £1,171/month outside London.',
    ],
    publicVsPrivateSummary:
      'UK Public universities (including Russell Group, Red Brick, and Modern Post-92 institutions) deliver strong employer recognition with tuition typically ranging from £14,500 to £32,000/yr. Accredited Private and pathway providers offer smaller classes, extended intake calendars, and conditional CAS flexibility.',
    englishAndMoiPolicy:
      'Most UK Public universities require IELTS 6.0–6.5 (no band below 5.5), though many Modern universities waive IELTS when Standard XII English marks are 70%+ (CBSE/ISC/State boards) or via a university-verified Medium of Instruction (MOI) letter.',
    topSubjects: [
      'Data Science & AI',
      'Business & Management',
      'Healthcare Management',
      'Cybersecurity',
      'Supply Chain & Logistics',
    ],
    featuredUniversities: [
      { name: 'University of Manchester', sector: 'Public' },
      { name: 'University of Leeds', sector: 'Public' },
      { name: 'Coventry University', sector: 'Public' },
      { name: 'University of Hertfordshire', sector: 'Public' },
      { name: 'University of Law', sector: 'Private' },
      { name: 'Arden University', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long is the UK post-study work visa in 2026–2027?',
        answer:
          'Applications submitted on or before 31 December 2026 receive 2 years under the Graduate Route; standard Bachelor and Master applications from 1 January 2027 transition to 18 months (1.5 years), while PhD graduates continue to qualify for 3 years.',
      },
      {
        question: 'How much show money is needed for a UK Student Visa?',
        answer:
          'UKVI requires unpaid first-year tuition plus 9 months of living funds: £1,529/month in London (£13,761) or £1,171/month outside London (£10,539) up to 29 November 2026 (increasing to £1,570 and £1,203 respectively from 30 November 2026), held continuously for at least 28 days.',
      },
      {
        question: 'Can I study a Master degree in the UK without IELTS?',
        answer:
          'Yes. Selected UK universities grant English waivers for 70%+ in Class 12 English (CBSE/ISC) or an accredited undergraduate degree taught in English alongside a Medium of Instruction (MOI) letter or internal online English test.',
      },
      {
        question: 'When are the main UK university intakes?',
        answer:
          'September is the primary intake with full course availability, while January/February and May intakes open wide seats across Business, Computing, Healthcare, and Engineering.',
      },
    ],
  },
  {
    slug: 'germany',
    country: 'Germany',
    metaTitle: 'Study in Germany (2026) — €0 Tuition & Visa',
    metaDescription:
      'Explore tuition-free German Public universities and English-taught Private programmes, €11,904 Sperrkonto rules, APS, and 18-month stay-back.',
    keywords: [
      'study in Germany free tuition',
      'German public universities English taught',
      'Germany blocked account 2026',
      'Germany 18 month job seeker visa',
      'APS certificate Germany',
    ],
    heroEyebrow: '2026 Germany Study & Visa Guide',
    heroHeadline: 'Study in Germany.',
    heroSubheadline:
      'Tuition-free Public universities, world-leading engineering and AI research, Sperrkonto €11,904/yr proof, and an 18-month Job-Seeker residence permit.',
    editorialOverview: [
      'Germany is Europe’s premier high-ROI destination for Engineering, Computer Science, Data Analytics, Sustainable Mobility, and Supply Chain Management. Public state universities across nearly all federal states charge €0 tuition even for non-EU students, requiring only a nominal €150–€350 semester contribution covering local transit and student services.',
      'Graduates from German universities qualify for an 18-month Job-Seeker residence permit with unrestricted work rights while transitioning to skilled employment or an EU Blue Card. Visa applicants must open a blocked account (Sperrkonto) showing €11,904/year (€992/month), and applicants from India, Vietnam, or China require an APS verification certificate before visa booking.',
    ],
    publicVsPrivateSummary:
      'German Public universities (TU9 research institutes and Universities of Applied Sciences / FH) charge €0 tuition (€1,500/semester exception in Baden-Württemberg) with competitive 65%–75%+ academic entry bars. Private universities such as IU, SRH, Gisma, and BSBI accept broader profiles (55%+) with March/April and September/October flexibility.',
    englishAndMoiPolicy:
      'English-taught Master degrees generally require IELTS 6.0–6.5 or TOEFL iBT 80–90. Select Private institutions accept MOI waivers with an admissions interview.',
    topSubjects: [
      'Computer Science & AI',
      'Automotive & Mechanical Engineering',
      'Renewable Energy',
      'Supply Chain & Logistics',
      'International Business & Management',
    ],
    featuredUniversities: [
      { name: 'Technical University of Munich (TUM)', sector: 'Public' },
      { name: 'RWTH Aachen University', sector: 'Public' },
      { name: 'University of Stuttgart', sector: 'Public' },
      { name: 'SRH Berlin University of Applied Sciences', sector: 'Private' },
      { name: 'Gisma University of Applied Sciences', sector: 'Private' },
      { name: 'IU International University', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'Are Public universities in Germany completely tuition-free in 2026?',
        answer:
          'Yes across 15 of 16 German states for consecutive programmes—students pay only €150–€350 per semester for administration and public transport. Universities in Baden-Württemberg charge €1,500 per semester for non-EU students.',
      },
      {
        question: 'How much money is required for a German Blocked Account (Sperrkonto)?',
        answer:
          'The official 2026 German student visa Sperrkonto requirement is €11,904 per year (€992 per month), held in an approved provider account before your embassy appointment.',
      },
      {
        question: 'How long is Germany post-study stay-back after graduation?',
        answer:
          'Graduates receive an 18-month job-seeking residence permit during which they may work any job without restriction while securing qualified employment for a work visa or EU Blue Card.',
      },
      {
        question: 'Is German language mandatory to study in Germany?',
        answer:
          'No for English-taught degrees, which are widely available at Master and Business levels; however, learning A2–B1 German boosts part-time and post-study job prospects significantly.',
      },
    ],
  },
  {
    slug: 'sweden',
    country: 'Sweden',
    metaTitle: 'Study in Sweden (2026) — Masters & 12-Month Visa',
    metaDescription:
      'Compare Swedish universities, official 12-month Bachelor & Master stay-back rules, SEK 10,656/mo Migrationsverket proof, and SI scholarships.',
    keywords: [
      'study in Sweden 2026',
      'Sweden post study work visa 12 months',
      'does Sweden have 2 year stay back',
      'Sweden Migrationsverket show money 2026',
      'Halmstad KTH Chalmers English masters',
    ],
    heroEyebrow: '2026 Sweden Study & Visa Guide',
    heroHeadline: 'Study in Sweden.',
    heroSubheadline:
      'Over 1,000 English-taught degrees, flat Nordic campus culture, 12-month post-study residence permit, and Migrationsverket SEK 10,656/month financial proof.',
    editorialOverview: [
      'Sweden blends globally respected public research institutions—including KTH Royal Institute of Technology, Chalmers, Uppsala University, Halmstad University, and Lund University—with an innovation economy spanning clean tech, fintech, robotics, and sustainable business.',
      'Under official 2026 Migrationsverket policy, Sweden does NOT offer a 2-year stay-back for taught degrees: Bachelor and Master graduates receive a 12-month (1 year) residence permit to seek employment or start a business (non-extendable), while 12–18 month permits apply strictly to PhD/doctoral researchers. Applicants must show SEK 10,656/month (SEK 127,872/year) in liquid funds plus first-year tuition.',
    ],
    publicVsPrivateSummary:
      'Sweden’s higher-education system is overwhelmingly Public and state-accredited, charging transparent tuition typically ranging from €9,500 to €16,000/yr alongside a handful of foundation-run private business and technology institutions.',
    englishAndMoiPolicy:
      'Most Swedish universities require IELTS 6.5 (no section below 5.5) or TOEFL iBT 90 through the centralized Universityadmissions.se portal; certain applicants with full English-medium Bachelor degrees from recognized universities qualify for English exemption per Universityadmissions.se country rules.',
    topSubjects: [
      'Sustainable Technology & Clean Energy',
      'Entrepreneurship & Business Development',
      'Computer Science & Robotics',
      'Life Sciences & Biotech',
      'Industrial Design & Innovation',
    ],
    featuredUniversities: [
      { name: 'KTH Royal Institute of Technology', sector: 'Public' },
      { name: 'Lund University', sector: 'Public' },
      { name: 'Halmstad University', sector: 'Public' },
      { name: 'Chalmers University of Technology', sector: 'Private' },
      { name: 'Jönköping University', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'Does Sweden offer a 2-year stay-back visa after a Master degree?',
        answer:
          'No. Under current 2026 Migrationsverket rules, Bachelor and Master graduates qualify for a 12-month (1-year) residence permit to look for work or start a business. A longer 12–18 month permit applies only to PhD/doctoral graduates.',
      },
      {
        question: 'What is Sweden’s 2026 Migrationsverket living cost requirement?',
        answer:
          'For residence permit applications in 2026, Migrationsverket requires proof of SEK 10,656 per month (SEK 127,872 for 12 months, approximately €11,500) in bank savings covering your stay.',
      },
      {
        question: 'When is the deadline for Sweden Autumn intake?',
        answer:
          'Central applications on Universityadmissions.se open in mid-October and close around 15 January for Autumn (August) entry, making early document preparation essential.',
      },
      {
        question: 'Can spouses accompany students in Sweden?',
        answer:
          'Yes. Spouses/partners of full-time students in Sweden can apply for dependent residence permits with full work rights, subject to additional Migrationsverket monthly maintenance funds.',
      },
    ],
  },
  {
    slug: 'ireland',
    country: 'Ireland',
    metaTitle: 'Study in Ireland (2026) — Stamp 1G & Tech Degrees',
    metaDescription:
      'Compare Irish Public & Private colleges, 2-year Stamp 1G Master stay-back, €10,000 visa proof, and Dublin tech and biopharma career pathways.',
    keywords: [
      'study in Ireland 2026',
      'Ireland Stamp 1G 2 year stay back',
      'Trinity UCD TU Dublin international fees',
      'Ireland student visa show money 10000',
    ],
    heroEyebrow: '2026 Ireland Study & Visa Guide',
    heroHeadline: 'Study in Ireland.',
    heroSubheadline:
      'Europe’s English-speaking tech and biopharma capital with a 2-year Stamp 1G post-study permit for Master graduates and €10,000/yr visa funds.',
    editorialOverview: [
      'Ireland hosts European headquarters for global technology, cloud computing, and life-science employers—giving international graduates immediate access to English-language R&D roles in Dublin, Cork, Galway, and Limerick.',
      'Under Ireland’s Third Level Graduate Programme (Stamp 1G), NFQ Level 9 Master and Level 10 PhD graduates receive 12 months initially—renewable up to 24 months (2 years) total—while NFQ Level 8 Honours Bachelor graduates receive 12 months (1 year). Students prove access to €10,000/year for visa financial clearance.',
    ],
    publicVsPrivateSummary:
      'Ireland combines prestigious Public research universities and newly consolidated Technological Universities (€13,000–€24,000/yr) with recognized Private colleges such as NCI, Dublin Business School, and Griffith College (€9,500–€14,000/yr) offering September and January intakes.',
    englishAndMoiPolicy:
      'IELTS 6.0–6.5 or Duolingo DET 110–120 is widely accepted across Ireland; selected private colleges and pathway programmes allow internal English tests or strong High School English transcripts.',
    topSubjects: [
      'Cloud Computing & Cybersecurity',
      'Data Analytics & FinTech',
      'Pharmaceutical & Biotechnology',
      'Supply Chain Management',
      'Business Analytics',
    ],
    featuredUniversities: [
      { name: 'Trinity College Dublin', sector: 'Public' },
      { name: 'University College Dublin (UCD)', sector: 'Public' },
      { name: 'University of Galway', sector: 'Public' },
      { name: 'University of Limerick', sector: 'Public' },
      { name: 'Dublin Business School (DBS)', sector: 'Private' },
      { name: 'Griffith College Ireland', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long is Stamp 1G stay-back in Ireland for Bachelor vs Master?',
        answer:
          'NFQ Level 8 Honours Bachelor graduates receive 12 months (1 year) on Stamp 1G, whereas NFQ Level 9 Master and Level 10 PhD graduates receive up to 24 months (2 years).',
      },
      {
        question: 'How much show money is required for an Irish Student Visa?',
        answer:
          'Non-EEA visa-required students typically demonstrate immediate access to at least €10,000 for living costs in addition to paid or scheduled tuition deposits.',
      },
      {
        question: 'Does Ireland have January intake courses?',
        answer:
          'Yes. Alongside the flagship September intake, several Technological Universities and Private colleges offer January/February intakes in IT, Data Analytics, and Business.',
      },
      {
        question: 'Do Irish universities accept Duolingo English Test (DET)?',
        answer:
          'Yes, most Irish universities and colleges accept official Duolingo scores (typically 110–120 overall) alongside IELTS, PTE, and TOEFL.',
      },
    ],
  },
  {
    slug: 'netherlands',
    country: 'Netherlands',
    metaTitle: 'Study in the Netherlands (2026) — Zoekjaar Visa',
    metaDescription:
      'Browse Dutch Research Universities & UAS degrees, 1-year Zoekjaar orientation visa, and official 2026 IND €13,569/yr living funds benchmarks.',
    keywords: [
      'study in Netherlands 2026',
      'Netherlands orientation year zoekjaar',
      'IND living expenses 2026 Netherlands',
      'TU Delft University of Amsterdam English masters',
    ],
    heroEyebrow: '2026 Netherlands Study & Visa Guide',
    heroHeadline: 'Study in the Netherlands.',
    heroSubheadline:
      'Globally ranked English research universities, 1-year Orientation Year (Zoekjaar) job permit, and transparent 2026 IND €1,130.77/mo living norms.',
    editorialOverview: [
      'The Netherlands delivers more English-taught university programmes than almost any non-Anglophone country in Europe, led by top 150 global institutions in Delft, Amsterdam, Eindhoven, Utrecht, and Groningen.',
      'After graduating from an accredited Dutch degree, international students qualify for a 1-year Orientation Year (Zoekjaar) residence permit allowing unrestricted work rights and a reduced salary threshold for the Highly Skilled Migrant visa. For 2026 student visas, the IND requires €1,130.77/month (€13,569.24/year) alongside tuition.',
    ],
    publicVsPrivateSummary:
      'Dutch Public universities split into Research Universities (WO, 3-yr Bachelor / 1–2-yr Master) and Universities of Applied Sciences (HBO, practice-oriented 4-yr Bachelor / 1-yr Master) with tuition generally €10,500–€22,000/yr; Private business schools like Nyenrode and Wittenborg serve smaller cohorts with multiple intakes.',
    englishAndMoiPolicy:
      'IELTS 6.0–6.5 or TOEFL iBT 80–92 is standard; MOIs are generally only waived for degrees earned in native English-speaking countries.',
    topSubjects: [
      'Artificial Intelligence & High-Tech Systems',
      'Water & Sustainable Engineering',
      'Econometrics & Data Science',
      'International Logistics & Supply Chain',
      'International Business',
    ],
    featuredUniversities: [
      { name: 'Delft University of Technology (TU Delft)', sector: 'Public' },
      { name: 'University of Amsterdam', sector: 'Public' },
      { name: 'Eindhoven University of Technology', sector: 'Public' },
      { name: 'Fontys University of Applied Sciences', sector: 'Public' },
      { name: 'Wittenborg University of Applied Sciences', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How does the Dutch Orientation Year (Zoekjaar) work?',
        answer:
          'You have up to 3 years after graduating in the Netherlands (or a top-200 global university) to activate a 1-year Zoekjaar permit giving you free labour-market access.',
      },
      {
        question: 'What is the IND 2026 show-money proof for Dutch student visas?',
        answer:
          'Your university sponsors your MVV/residence permit directly once you transfer 1st-year tuition plus the 2026 IND living norm of €1,130.77/month (€13,569.24/year) to the university’s escrow account.',
      },
      {
        question: 'What is the difference between WO and HBO universities in the Netherlands?',
        answer:
          'WO Research Universities focus on academic theory and R&D (3-yr Bachelors), while HBO Universities of Applied Sciences focus on hands-on internships and industry readiness (4-yr Bachelors).',
      },
      {
        question: 'When should I apply to Dutch universities?',
        answer:
          'Numerus Fixus and scholarship deadlines often close by 15 January – 1 February, while non-EU visa deadlines typically fall between 1 April and 1 May for September start.',
      },
    ],
  },
  {
    slug: 'australia',
    country: 'Australia',
    metaTitle: 'Study in Australia (2026) — Subclass 485 & GS',
    metaDescription:
      'Compare Group of Eight and ATN universities, 2–3 year Subclass 485 post-study work rights, and AUD 29,710/yr Genuine Student financial proof.',
    keywords: [
      'study in Australia 2026',
      'Australia subclass 485 post study work visa 2026',
      'Australia Genuine Student financial capacity AUD 29710',
      'Melbourne Sydney Monash masters',
    ],
    heroEyebrow: '2026 Australia Study & Visa Guide',
    heroHeadline: 'Study in Australia.',
    heroSubheadline:
      'High graduate salaries, Group of Eight campuses, Subclass 485 post-study work rights (2–3 years), and AUD 29,710/year financial proof.',
    editorialOverview: [
      'Australia combines world-top-50 public research universities with high post-study earning potential across Health Sciences, Engineering, Cybersecurity, Mining, and Accounting. Main intakes run in February and July, with regional cities offering lower living expenses and extra migration points.',
      'Under current Home Affairs Subclass 485 rules, international graduates receive 2 years post-study work rights for Bachelor and Coursework Master degrees, 3 years for Research Masters and PhDs, and 18 months for eligible Vocational qualifications (with extra regional extensions where eligible). Visa applicants satisfy the Genuine Student (GS) criterion and demonstrate AUD 29,710/year in living funds.',
    ],
    publicVsPrivateSummary:
      'Almost all major Australian universities—including University of Melbourne, UNSW, Sydney, Monash, UQ, and RMIT—are Public institutions charging AUD 32,000–AUD 52,000/yr (~€19,500–€31,500), complemented by accredited Private higher-education institutes with smaller classes and lower fees.',
    englishAndMoiPolicy:
      'Standard Subclass 500 student visas require IELTS 6.0–6.5 or PTE Academic 54–58+, typically strict on official test validity.',
    topSubjects: [
      'Information Technology & Cloud',
      'Nursing & Allied Health',
      'Civil & Mining Engineering',
      'Business Analytics & Accounting',
      'Cybersecurity',
    ],
    featuredUniversities: [
      { name: 'University of Melbourne', sector: 'Public' },
      { name: 'Monash University', sector: 'Public' },
      { name: 'UNSW Sydney', sector: 'Public' },
      { name: 'RMIT University', sector: 'Public' },
      { name: 'Torrens University Australia', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How many years of stay-back does Australia offer after a Coursework Master?',
        answer:
          'Standard Subclass 485 Temporary Graduate visas grant 2 years for Bachelor and Coursework Masters (and 3 years for Research Masters and PhD graduates), with potential regional extensions for regional campuses.',
      },
      {
        question: 'What is the 2026 Australian student visa living-cost benchmark?',
        answer:
          'Department of Home Affairs requires evidence of AUD 29,710 per year for student living expenses alongside first-year tuition fees and travel costs.',
      },
      {
        question: 'Did Genuine Student (GS) replace GTE in Australia?',
        answer:
          'Yes. Applicants answer targeted Genuine Student questions explaining study choices, academic progression, and economic/career benefit in place of the former 300-word GTE essay.',
      },
      {
        question: 'Are merit scholarships available in Australia?',
        answer:
          'Yes, most Australian public universities automatically assess high-achieving international applicants for 15%–30% merit tuition scholarships.',
      },
    ],
  },
  {
    slug: 'canada',
    country: 'Canada',
    metaTitle: 'Study in Canada (2026) — PGWP Degrees & GIC Proof',
    metaDescription:
      'Compare Canadian Public DLIs, up to 3-year PGWP degree rules, PAL steps, and CAD 22,895–23,448/yr GIC living funds benchmarks.',
    keywords: [
      'study in Canada 2026',
      'Canada PGWP 3 year work permit',
      'Canada GIC requirement 2026 CAD 22895',
      'Canada co-op masters universities',
    ],
    heroEyebrow: '2026 Canada Study & Visa Guide',
    heroHeadline: 'Study in Canada.',
    heroSubheadline:
      'Paid university co-op terms, up to 3-year PGWP post-graduation work permits for degree holders, and structured PR pathways.',
    editorialOverview: [
      'Canada remains a premier North American destination thanks to co-operative work terms, multicultural campuses, and transparent immigration links between graduation and Express Entry or Provincial Nominee Programs.',
      'Under updated IRCC rules, university Bachelor, Master, and PhD graduates remain eligible for up to 3-year Post-Graduation Work Permits (PGWP) when completing full-time degree programmes at Public Designated Learning Institutions (DLIs), while financial proof stands at CAD 22,895/yr until 31 August 2026 and CAD 23,448/yr from 1 September 2026.',
    ],
    publicVsPrivateSummary:
      'Public DLIs (Toronto, UBC, Waterloo, Dalhousie, Seneca, Conestoga) hold primary PGWP priority for degree and aligned technical diplomas; private institutions only grant PGWP when specifically authorised under provincial degree/alignment criteria.',
    englishAndMoiPolicy:
      'IELTS 6.0–6.5 or PTE Academic / TOEFL equivalent is required for Canadian study permits.',
    topSubjects: [
      'Data Science & Software Systems',
      'Supply Chain & Project Management',
      'Civil & Mechanical Engineering',
      'Healthcare Administration',
      'Finance & MBA',
    ],
    featuredUniversities: [
      { name: 'University of British Columbia (UBC)', sector: 'Public' },
      { name: 'University of Toronto', sector: 'Public' },
      { name: 'University of Waterloo', sector: 'Public' },
      { name: 'Dalhousie University', sector: 'Public' },
      { name: 'University Canada West', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'Do Master degrees in Canada still get a 3-year PGWP in 2026?',
        answer:
          'Yes. Full-time university degree programmes (including Master’s degrees of 8+ months under updated PGWP rules) qualify for up to a 3-year Post-Graduation Work Permit, subject to CLBs/NCLC language proof upon PGWP application.',
      },
      {
        question: 'What is the 2026 Canada student visa financial proof amount?',
        answer:
          'IRCC living funds proof (outside Quebec) is CAD 22,895/yr plus tuition up to 31 August 2026, increasing to CAD 23,448/yr from 1 September 2026.',
      },
      {
        question: 'What is a Provincial Attestation Letter (PAL)?',
        answer:
          'Most study permit applicants require a PAL/TAL issued via their province after accepting an offer; verify exemptions or institutional allocation with admissions before deposit.',
      },
      {
        question: 'Are paid co-ops common in Canada?',
        answer:
          'Yes, Canadian universities and polytechnics build paid 4–12 month co-op terms into Computer Science, Engineering, and Business programmes.',
      },
    ],
  },
  {
    slug: 'poland',
    country: 'Poland',
    metaTitle: 'Study in Poland (2026) — Low Fees & 9-Month Visa',
    metaDescription:
      'Explore English-taught Public & Private universities in Warsaw, Krakow & Wroclaw from €2,000–€5,000/yr, MOI waivers, and 9-month stay-back.',
    keywords: [
      'study in Poland 2026',
      'Poland universities tuition fees EUR',
      'Warsaw University of Technology English masters',
      'Poland post study stay back visa 9 months',
    ],
    heroEyebrow: '2026 Poland Study & Visa Guide',
    heroHeadline: 'Study in Poland.',
    heroSubheadline:
      'EU Schengen degree programmes from €2,000–€5,000/year, central European tech centers in Warsaw and Krakow, and 9-month graduate stay-back.',
    editorialOverview: [
      'Poland combines ultra-low European tuition fees with rapidly expanding engineering, IT, and shared-services job markets across Warsaw, Krakow, Wroclaw, Gdansk, and Poznan.',
      'Full-time English-taught Bachelor and Master graduates from Polish universities qualify for a 9-month temporary residence permit after graduation to seek employment or register a business, with updated NAWA/national visa guidelines requiring strong academic records and 701–776 PLN/month + 2,500 PLN return travel funds.',
    ],
    publicVsPrivateSummary:
      'Polish Public universities (Warsaw Tech, University of Warsaw, Jagiellonian, AGH) average €2,500–€5,000/yr with strong QS standings. Accredited Private institutions (Kozminski University, Vistula, SWPS, WSB Merito) offer streamlined online interviews and October/March intakes (€2,800–€5,500/yr).',
    englishAndMoiPolicy:
      'Selected Private and Public Polish institutions accept IELTS 5.5–6.0 or an official Medium of Instruction (MOI) letter verified via admissions interview.',
    topSubjects: [
      'Computer Science & Applied IT',
      'Business Analytics & Finance',
      'Aerospace & Energy Engineering',
      'International Relations & Logistics',
      'Architecture & Urban Design',
    ],
    featuredUniversities: [
      { name: 'Warsaw University of Technology', sector: 'Public' },
      { name: 'University of Warsaw', sector: 'Public' },
      { name: 'Jagiellonian University in Krakow', sector: 'Public' },
      { name: 'AGH University of Krakow', sector: 'Public' },
      { name: 'Kozminski University', sector: 'Private' },
      { name: 'Vistula University', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long can international graduates stay in Poland after graduation?',
        answer:
          'Graduates of full-time studies at Polish universities qualify for a 9-month post-study job-seeking temporary residence permit.',
      },
      {
        question: 'How affordable are Polish university tuition fees?',
        answer:
          'Public and Private English-taught programmes typically range between €2,000 and €5,000 per academic year, alongside low student housing and transit costs.',
      },
      {
        question: 'Can I study in Poland without IELTS?',
        answer:
          'Many Polish universities waive IELTS upon submitting an official MOI certificate paired with a live university English interview, though B2 language readiness is mandatory.',
      },
      {
        question: 'What are the main intakes in Poland?',
        answer:
          'October is the primary intake across all Polish universities, while February/March opens seats in Engineering, IT, and Management.',
      },
    ],
  },
  {
    slug: 'malta',
    country: 'Malta',
    metaTitle: 'Study in Malta (2026) — MOI Degrees & 70% Rebate',
    metaDescription:
      'Compare accredited Maltese colleges, English EU Schengen environment, 9-month graduate stay-back, and up to 70% Get Qualified tax credits.',
    keywords: [
      'study in Malta 2026',
      'Malta Get Qualified 70 tax rebate',
      'study in Malta without IELTS MOI',
      'Malta post study work visa 9 months',
    ],
    heroEyebrow: '2026 Malta Study & Visa Guide',
    heroHeadline: 'Study in Malta.',
    heroSubheadline:
      'English-speaking EU Schengen hub accepting MOI waivers, offering 9-month post-study stay-back and up to 70% Get Qualified tuition tax credits.',
    editorialOverview: [
      'Malta is an English-speaking Mediterranean EU and Schengen member state specializing in FinTech, Hospitality Management, iGaming Analytics, Maritime Business, and Healthcare.',
      'Graduates from MFHEA-accredited MQF Level 5–7 programmes qualify for a 9-month post-study employment extension while transitioning to a Single Permit, and working graduates may claim up to 70% of tuition fees back in Maltese income tax credits under the Get Qualified scheme.',
    ],
    publicVsPrivateSummary:
      'University of Malta and MCAST anchor Public tuition (€8,500–€12,500/yr), while regulated Private colleges (GBS Malta, Global College Malta, Domain Academy, ASCENCIA) deliver multiple rolling intakes (February, May, September/October) from €5,500–€9,000/yr.',
    englishAndMoiPolicy:
      'Most Private Maltese colleges accept Medium of Instruction (MOI) waivers or internal English assessments alongside IELTS 5.5–6.0.',
    topSubjects: [
      'MBA & International Management',
      'Hospitality & Tourism Leadership',
      'FinTech & Data Analytics',
      'Computer Science',
      'Healthcare Management',
    ],
    featuredUniversities: [
      { name: 'University of Malta', sector: 'Public' },
      { name: 'MCAST (Malta College of Arts, Science & Technology)', sector: 'Public' },
      { name: 'GBS Malta', sector: 'Private' },
      { name: 'Global College Malta', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How does the 70% Get Qualified tax rebate in Malta work?',
        answer:
          'Students graduating from approved MQF Level 5–8 qualifications who take up taxable employment in Malta can apply to reclaim up to 70% of eligible tuition fees as progressive income tax credits.',
      },
      {
        question: 'How long is post-study stay-back in Malta?',
        answer:
          'International graduates qualify for a 9-month residence extension (Identità) to search for work in Malta and transition to a work permit.',
      },
      {
        question: 'Do Maltese colleges accept MOI instead of IELTS?',
        answer:
          'Yes, most MFHEA-licensed private business colleges accept an MOI certificate and internal interview, whereas University of Malta generally requests IELTS/TOEFL.',
      },
      {
        question: 'Is part-time work allowed on a Malta student visa?',
        answer:
          'Yes, non-EU students may apply through Jobsplus after their first 90 days in Malta to work up to 20 hours/week legally.',
      },
    ],
  },
  {
    slug: 'denmark',
    country: 'Denmark',
    metaTitle: 'Study in Denmark (2026) — 3-Year Stay-Back Visa',
    metaDescription:
      'Discover Danish state-approved Public universities, automatic 3-year graduate job-search permit, and 2026 SIRI DKK 7,426/mo living proof.',
    keywords: [
      'study in Denmark 2026',
      'Denmark 3 year post study work visa',
      'SIRI Denmark student visa financial proof 2026',
      'DTU CBS Aarhus English masters',
    ],
    heroEyebrow: '2026 Denmark Study & Visa Guide',
    heroHeadline: 'Study in Denmark.',
    heroSubheadline:
      'High Nordic quality of life, state-approved English Bachelor & Master degrees, and an industry-leading 3-year graduate job-seeking permit.',
    editorialOverview: [
      'Denmark stands out inside the European Union by granting graduates of state-approved higher education programmes an automatic 3-year job-seeking residence permit with full work permission right after completing their degree.',
      'Visa applications managed by SIRI require proof of DKK 7,426/month (DKK 89,112/year ≈ €11,950) for living support alongside paid semester tuition.',
    ],
    publicVsPrivateSummary:
      'Denmark’s university sector is almost entirely Public—including Technical University of Denmark (DTU), Copenhagen Business School (CBS), University of Copenhagen, Aarhus University, and Aalborg University—charging €8,500–€17,000/yr.',
    englishAndMoiPolicy:
      'IELTS 6.5 (no section under 6.0) or TOEFL iBT 83–90 is strictly required unless prior full-time university education was completed inside select native-English countries.',
    topSubjects: [
      'Wind & Sustainable Energy',
      'Data Science & Bioinformatics',
      'International Business (CBS)',
      'Robotics & Autonomous Systems',
      'Architecture & Urban Innovation',
    ],
    featuredUniversities: [
      { name: 'Technical University of Denmark (DTU)', sector: 'Public' },
      { name: 'Copenhagen Business School (CBS)', sector: 'Public' },
      { name: 'Aarhus University', sector: 'Public' },
      { name: 'University of Southern Denmark (SDU)', sector: 'Public' },
    ],
    faqs: [
      {
        question: 'Does Denmark give a 3-year stay-back after Bachelor and Master degrees?',
        answer:
          'Yes. Non-EU graduates completing a state-approved Danish Bachelor, Master, or PhD receive an automatic 3-year job-seeking permit to work and settle in Denmark.',
      },
      {
        question: 'What is the 2026 SIRI financial proof requirement for Denmark?',
        answer:
          'For 2026 student residence permits, SIRI specifies DKK 7,426 per month (DKK 89,112/year) in personal bank funds alongside paid first-term tuition.',
      },
      {
        question: 'Can students work part-time in Denmark?',
        answer:
          'Yes. International students may work up to 20 hours per week (90 hours/month standard term) and full-time in June, July, and August.',
      },
      {
        question: 'When are Danish Master deadlines for September intake?',
        answer:
          'Most non-EU application windows close between 15 January and 1 March for September enrolment.',
      },
    ],
  },
  {
    slug: 'france',
    country: 'France',
    metaTitle: 'Study in France (2026) — Grandes Écoles & RECE',
    metaDescription:
      'Compare French Public universities and Grandes Écoles, 12-month RECE / 2-year India Master stay-back, Campus France steps, and CAF rent aid.',
    keywords: [
      'study in France 2026',
      'France RECE APS post study visa',
      'Campus France Etudes en France 2026',
      'Grandes Ecoles MiM MSc tuition EUR',
    ],
    heroEyebrow: '2026 France Study & Visa Guide',
    heroHeadline: 'Study in France.',
    heroSubheadline:
      'Triple-accredited Grande École Master in Management programmes, subsidized Public tuition, CAF rent aid, and 12-month RECE (2-yr bilateral India Master) stay-back.',
    editorialOverview: [
      'France pairs world-famous Grandes Écoles for Luxury Brand Management, Finance, and Data Engineering with ultra-affordable state universities subsidized by the French Republic, plus monthly CAF government housing support accessible to international students.',
      'Master and Grande École graduates qualify for the 12-month RECE (job-search / business-creation) residence card—and Indian Master graduates enjoy an extended 2-year post-study bilateral arrangement. Campus France requires €615–€800/month minimum financial proof (~€7,380–€9,600/yr).',
    ],
    publicVsPrivateSummary:
      'French Public universities charge low national differentiated fees (€2,850–€3,879/yr, often partially waived by Campus France/universities), while Elite Private Grandes Écoles (SKEMA, EDHEC, KEDGE, NEOMA, ESSEC, EM Lyon) charge €12,000–€24,000/yr with powerhouse corporate alumni ties.',
    englishAndMoiPolicy:
      'English-taught MSc/MiM programmes accept IELTS 6.0–6.5 or internal MOI + admission interview across select Grandes Écoles.',
    topSubjects: [
      'Master in Management (MiM)',
      'Luxury Brand & Fashion Management',
      'Quantitative Finance & FinTech',
      'Aerospace Engineering',
      'Data Science & AI',
    ],
    featuredUniversities: [
      { name: 'Université Paris-Saclay', sector: 'Public' },
      { name: 'Sorbonne University', sector: 'Public' },
      { name: 'EDHEC Business School', sector: 'Private' },
      { name: 'SKEMA Business School', sector: 'Private' },
      { name: 'KEDGE Business School', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long is post-study stay-back in France?',
        answer:
          'Standard French Master/Grade de Master graduates qualify for a 12-month RECE permit (non-renewable, converting to work permit upon job offer), while Indian nationals holding French Master degrees benefit from a bilateral 2-year total stay-back rule.',
      },
      {
        question: 'What is Campus France Etudes en France?',
        answer:
          'It is the mandatory official pre-consular academic & interview channel required before applying for a long-stay French VLS-TS student visa in India and ~65 partner countries.',
      },
      {
        question: 'Do international students get CAF rent subsidies in France?',
        answer:
          'Yes! Students renting legal apartments or CROUS residences with an active French bank account can claim monthly CAF housing assistance reducing rent by 20%–35%.',
      },
      {
        question: 'Are French Grandes Écoles taught in English?',
        answer:
          'Yes. Over 1,600 English-taught MSc, MiM, MBA, and Engineering degrees require no prior French at admission.',
      },
    ],
  },
  {
    slug: 'latvia',
    country: 'Latvia',
    metaTitle: 'Study in Latvia (2026) — Tuition & OCMA Stay-Back',
    metaDescription:
      'Browse Latvian Public Technical Universities and Riga colleges from €2,500/yr, AIC verification, €740/mo OCMA proof, and 4–9 month stay-back.',
    keywords: [
      'study in Latvia 2026',
      'RTU Riga Technical University fees',
      'Latvia OCMA show money 740 EUR',
      'Latvia AIC certificate post study visa',
    ],
    heroEyebrow: '2026 Latvia Study & Visa Guide',
    heroHeadline: 'Study in Latvia.',
    heroSubheadline:
      'EU Schengen engineering and IT degrees from €2,500–€4,500/yr in Riga, streamlined MOI options, and 4–9 month OCMA post-study permits.',
    editorialOverview: [
      'Latvia offers one of the most cost-effective entry points into the European Higher Education Area, led by Riga Technical University (RTU) and University of Latvia alongside private management colleges in Riga.',
      'All foreign secondary and degree transcripts undergo formal AIC academic verification before offer finalization. Under OCMA 2026 regulations, graduates qualify for a 4-month post-study search period (Bachelor) or 9-month job-seeking residence permit (Master/PhD), backed by €740/month (€8,880/yr) visa subsistence proof.',
    ],
    publicVsPrivateSummary:
      'Latvian Public technical and medical institutions (RTU, LU, RSU) charge €3,000–€5,500/yr for IT/Engineering (higher for Medicine), while Private institutions (ISMA, Turība, TSI) offer February and September intakes from €2,500–€3,800/yr.',
    englishAndMoiPolicy:
      'IELTS 5.5–6.0 or an official Medium of Instruction (MOI) letter verified through university admission interview.',
    topSubjects: [
      'Computer Systems & Robotics',
      'Aviation & Transport Management',
      'Logistics & E-Business',
      'Civil Engineering',
      'Healthcare & Medicine',
    ],
    featuredUniversities: [
      { name: 'Riga Technical University (RTU)', sector: 'Public' },
      { name: 'University of Latvia', sector: 'Public' },
      { name: 'Transport and Telecommunication Institute (TSI)', sector: 'Private' },
      { name: 'Turiba University', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long is Latvia stay-back after Master vs Bachelor?',
        answer:
          'Under OCMA rules, Bachelor graduates hold up to 4 months to transition to work permits, whereas Master and PhD graduates qualify for a 9-month job-seeking residence extension.',
      },
      {
        question: 'What is AIC verification in Latvia?',
        answer:
          'Academic Information Centre (AIC) legally evaluates your prior diplomas/transcripts to confirm equivalence to Latvian admission criteria prior to visa sponsorship.',
      },
      {
        question: 'How much show money is needed for a Latvia student TRP?',
        answer:
          'OCMA requires minimum living means equal to Latvia’s 2026 statutory minimum wage benchmark of €740/month (€8,880 for 12 months).',
      },
      {
        question: 'Can students work in Latvia during term?',
        answer:
          'Yes, full-time degree students holding a Temporary Residence Permit may work up to 20 hours per week (40 hours/week during holidays).',
      },
    ],
  },
  {
    slug: 'finland',
    country: 'Finland',
    metaTitle: 'Study in Finland (2026) — 2-Year Permit & Degrees',
    metaDescription:
      'Explore Finnish Research & UAS universities, merit tuition waivers, 2-year graduate job-search permit, and 2026 Migri €800/mo living proof.',
    keywords: [
      'study in Finland 2026',
      'Finland 2 year post study visa',
      'Finland Migri 800 EUR month proof',
      'Aalto LUT Tampere Metropolia English degrees',
    ],
    heroEyebrow: '2026 Finland Study & Visa Guide',
    heroHeadline: 'Study in Finland.',
    heroSubheadline:
      'World-renowned Nordic research and UAS Nursing/AI degrees with a 2-year post-study permit and Migri €800/month financial benchmark.',
    editorialOverview: [
      'Finland attracts engineering, healthcare/nursing, clean-energy, and software students worldwide via high-ranking research institutions and practical Universities of Applied Sciences (UAS) with close Nokia, Kone, and hospital-sector partnerships.',
      'Unlike some EU neighbors, Finland grants ALL international Bachelor, Master, and PhD graduates up to a 2-year residence permit to look for work or start a company. For 2026 Migri applications, students prove €800/month (€9,600/year) in bank funds plus tuition.',
    ],
    publicVsPrivateSummary:
      'Finnish Research Universities and Universities of Applied Sciences (UAS) are Public institutions charging €8,000–€18,000/yr, nearly all paired with early-bird tuition discounts or 25%–50% merit waivers.',
    englishAndMoiPolicy:
      'IELTS 6.0–6.5, PTE 55+, or SAT/national UAS entrance exams; limited MOI exemptions only for Anglophone degree holders.',
    topSubjects: [
      'Nursing & Global Health',
      '5G/AI & Software Engineering',
      'Circular Economy & Clean Tech',
      'Game Design & XR',
      'International Business',
    ],
    featuredUniversities: [
      { name: 'Aalto University', sector: 'Public' },
      { name: 'University of Helsinki', sector: 'Public' },
      { name: 'LUT University', sector: 'Public' },
      { name: 'Metropolia University of Applied Sciences', sector: 'Public' },
    ],
    faqs: [
      {
        question: 'How long is stay-back in Finland in 2026?',
        answer:
          'Graduates of accredited Finnish degrees receive a 2-year job-search/start-up residence permit—upgradable into an A-type continuous residence permit with full employment.',
      },
      {
        question: 'How much living money does Migri require for Finland?',
        answer:
          'Migri requires at least €800/month (€9,600 for 12 months) in immediately accessible personal savings alongside paid first-year tuition.',
      },
      {
        question: 'Are Nursing & Health programmes taught in English in Finland?',
        answer:
          'Yes, several UAS institutions (including Metropolia, Laurea, and JAMK) offer English-language Nursing & Health degrees integrated with Finnish clinical language tracks.',
      },
      {
        question: 'Are full or partial scholarships available?',
        answer:
          'Many Finnish universities offer 15%–50% early-payment discounts or Finland Scholarships for top-scoring Master applicants.',
      },
    ],
  },
  {
    slug: 'italy',
    country: 'Italy',
    metaTitle: 'Study in Italy (2026) — Public Fees & DSU Aid',
    metaDescription:
      'Study in Milan, Bologna, Rome & Turin with Public tuition from €500–€3,500/yr, Regional DSU grants, and 12-month post-study stay-back.',
    keywords: [
      'study in Italy 2026',
      'Italy DSU regional scholarship',
      'Politecnico di Milano University of Bologna English masters',
      'Italy student visa financial proof',
    ],
    heroEyebrow: '2026 Italy Study & Visa Guide',
    heroHeadline: 'Study in Italy.',
    heroSubheadline:
      'Europe’s oldest university heritage, English engineering & design masters from €500/yr with DSU scholarships, and 12-month post-study job permit.',
    editorialOverview: [
      'Italy stands among the highest-value European destinations thanks to regional DSU financial-aid grants—which combine full Public tuition waivers with free accommodation, canteen meals, and annual cash stipends when household income falls within thresholds.',
      'Post-study graduates qualify for a 12-month Permesso per attesa occupazione job-seeking permit, converting cleanly into a work permit upon hiring.',
    ],
    publicVsPrivateSummary:
      'Italian Public universities (Politecnico di Milano, Sapienza, Bologna, Padova, Torino) charge €156–€3,900/yr on income-linked scales. Elite Private institutions (Bocconi, Cattolica, Istituto Marangoni) charge €12,000–€22,000/yr for specialist Finance, Design, and Fashion tracks.',
    englishAndMoiPolicy:
      'B2 English certificate (IELTS 5.5–6.0); several Italian Public universities accept an official university MOI certificate via Universitaly pre-enrolment.',
    topSubjects: [
      'Mechanical & Aerospace Engineering',
      'Product & Automotive Design',
      'Economics & Management (Bocconi)',
      'Biotechnology & Medicine (IMAT)',
      'Data Science',
    ],
    featuredUniversities: [
      { name: 'Politecnico di Milano', sector: 'Public' },
      { name: 'University of Bologna', sector: 'Public' },
      { name: 'Sapienza University of Rome', sector: 'Public' },
      { name: 'Università Bocconi', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How do Regional DSU scholarships work in Italy?',
        answer:
          'Based on family income documentation (ISEE parificato ≤ ~€28,339.88 / ISPE caps), students can obtain tuition exemption plus meals, dormitory access, and €6,000–€7,500/yr stipends.',
      },
      {
        question: 'How long is stay-back in Italy after graduation?',
        answer:
          'Non-EU Master and PhD graduates qualify for a 12-month residence permit (attesa occupazione) to look for employment or launch self-employment.',
      },
      {
        question: 'What is Universitaly?',
        answer:
          'Universitaly is Italy’s mandatory national portal where international candidates pre-enrol after university admission to trigger their embassy visa dossier.',
      },
      {
        question: 'Can I apply to Italy with an MOI letter instead of IELTS?',
        answer:
          'Yes, multiple Italian Public universities accept official English-medium Bachelor MOI letters subject to embassy verification.',
      },
    ],
  },
  {
    slug: 'spain',
    country: 'Spain',
    metaTitle: 'Study in Spain (2026) — Public Unis & MBA Schools',
    metaDescription:
      'Compare Spanish Public universities in Madrid & Barcelona (€1,500–€5,000/yr), top Private business schools, and 12–24 month stay-back.',
    keywords: [
      'study in Spain 2026',
      'Spain post study job search visa 12 24 months',
      'Barcelona Madrid public universities English tuition',
    ],
    heroEyebrow: '2026 Spain Study & Visa Guide',
    heroHeadline: 'Study in Spain.',
    heroSubheadline:
      'Affordable Public Master degrees, world-top Private business schools in Madrid and Barcelona, and a 12–24 month post-study work permit.',
    editorialOverview: [
      'Spain combines vibrant Mediterranean campus cities (Madrid, Barcelona, Valencia) with bilingual European/LATAM commercial reach, making it especially strong for MBA, Tourism Innovation, Architecture, and AI Engineering.',
      'Graduates qualify for a 12–24 month post-study residence permit to search for skilled employment or establish an enterprise, supported by accessible IPREM monthly living funds (~€7,200/year).',
    ],
    publicVsPrivateSummary:
      'Public universities (UPM, UAB, Carlos III Madrid, UPF) charge ~€1,800–€6,000/yr, while world-ranked Private schools (IE University, ESADE, EU Business School Barcelona) run multiple intakes with extensive English portfolios.',
    englishAndMoiPolicy:
      'IELTS 6.0–6.5 for English tracks; private business schools also accept internal online testing or MOI with strong interviews.',
    topSubjects: [
      'Global MBA & Entrepreneurship',
      'Digital Marketing & Sports Management',
      'Hospitality & Tourism',
      'Renewable Energy Engineering',
      'Data Analytics',
    ],
    featuredUniversities: [
      { name: 'Universidad Carlos III de Madrid', sector: 'Public' },
      { name: 'Universitat Pompeu Fabra (UPF)', sector: 'Public' },
      { name: 'IE University', sector: 'Private' },
      { name: 'EU Business School Barcelona', sector: 'Private' },
    ],
    faqs: [
      {
        question: 'How long is Spain’s graduate stay-back residence permit?',
        answer:
          'Graduates from accredited Spanish degrees can transition into a 12–24 month residence authorization for job searching or starting a business.',
      },
      {
        question: 'Do Spanish student visas permit part-time work?',
        answer:
          'Yes! Recent reforms allow international higher-education students in Spain to work up to 30 hours per week directly alongside classes.',
      },
      {
        question: 'How much living funds proof is required for a Spanish visa?',
        answer:
          'Financial means correspond to 100% of Spain’s monthly IPREM benchmark (~€600/month or ~€7,200/year) plus private health insurance.',
      },
      {
        question: 'Are English-only Masters available in Spain?',
        answer:
          'Yes, particularly across Madrid and Barcelona in Business, Technology, Architecture, and Political Science.',
      },
    ],
  },
];

export function getAllDestinationSlugs(): string[] {
  return SEO_DESTINATION_GUIDES.map((g) => g.slug);
}

export function getDestinationGuideBySlug(slug: string): DestinationGuide | undefined {
  const clean = slug.trim().toLowerCase();
  return SEO_DESTINATION_GUIDES.find((g) => g.slug === clean);
}

export function getDestinationGuideByCountry(country?: string): DestinationGuide | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  const normalized = normalizeCountryName(trimmed) || trimmed;
  const lower = normalized.toLowerCase();
  return SEO_DESTINATION_GUIDES.find((g) => g.country.toLowerCase() === lower);
}

export function getCountryGuideHref(country?: string): string | null {
  const guide = getDestinationGuideByCountry(country);
  return guide ? `/study-in/${guide.slug}` : null;
}
