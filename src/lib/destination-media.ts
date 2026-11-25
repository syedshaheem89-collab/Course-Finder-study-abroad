import { normalizeCountryName } from './countries';

/**
 * Iconic landmark photographs hosted under public/images/
 * for zero-latency Apple Store-style destination and help cards.
 */
const DESTINATION_IMAGES: Record<string, string> = {
  'United Kingdom': '/images/dest-uk.jpg',
  'Germany': '/images/dest-germany.jpg',
  'Ireland': '/images/dest-ireland.jpg',
  'Netherlands': '/images/dest-netherlands.jpg',
  'Australia': '/images/dest-australia.jpg',
  'Sweden': '/images/dest-sweden.jpg',
  'Canada': '/images/dest-canada.jpg',
  'Poland': '/images/dest-poland.jpg',
  'Malta': '/images/dest-malta.jpg',
  'France': '/images/dest-france.jpg',
  'Denmark': '/images/dest-denmark.jpg',
  'Finland': '/images/dest-finland.jpg',
  'Italy': '/images/dest-italy.jpg',
  'Spain': '/images/dest-spain.jpg',
  'Latvia': '/images/dest-latvia.jpg',
  'Norway': '/images/dest-sweden.jpg',
  'Portugal': '/images/dest-spain.jpg',
  'Austria': '/images/dest-germany.jpg',
  'Switzerland': '/images/dest-germany.jpg',
  'Belgium': '/images/dest-netherlands.jpg',
  'Luxembourg': '/images/dest-netherlands.jpg',
  'Czech Republic': '/images/dest-poland.jpg',
  'Hungary': '/images/dest-poland.jpg',
  'Lithuania': '/images/dest-latvia.jpg',
  'Estonia': '/images/dest-finland.jpg',
  'Cyprus': '/images/dest-malta.jpg',
  'Greece': '/images/dest-malta.jpg',
  'New Zealand': '/images/dest-australia.jpg',
  'United States': '/images/dest-canada.jpg',
  'USA': '/images/dest-canada.jpg',
  'United Arab Emirates': '/images/dest-australia.jpg',
  'UAE': '/images/dest-australia.jpg',
  'Singapore': '/images/dest-canada.jpg',
  'South Korea': '/images/dest-germany.jpg',
  'Japan': '/images/dest-germany.jpg',
  'Malaysia': '/images/dest-australia.jpg',
};

export function getDestinationImage(country?: string): string {
  if (!country) return '/images/dest-uk.jpg';
  const trimmed = country.trim();
  if (DESTINATION_IMAGES[trimmed]) return DESTINATION_IMAGES[trimmed];
  const normalized = normalizeCountryName(trimmed);
  if (normalized && DESTINATION_IMAGES[normalized]) return DESTINATION_IMAGES[normalized];

  const lower = trimmed.toLowerCase();
  if (lower.includes('uk') || lower.includes('britain')) return '/images/dest-uk.jpg';
  if (lower.includes('germany') || lower.includes('austria') || lower.includes('swiss')) return '/images/dest-germany.jpg';
  if (lower.includes('ireland')) return '/images/dest-ireland.jpg';
  if (lower.includes('netherlands') || lower.includes('holland')) return '/images/dest-netherlands.jpg';
  if (lower.includes('australia') || lower.includes('zealand')) return '/images/dest-australia.jpg';
  if (lower.includes('sweden') || lower.includes('norway')) return '/images/dest-sweden.jpg';
  if (lower.includes('denmark')) return '/images/dest-denmark.jpg';
  if (lower.includes('finland') || lower.includes('estonia')) return '/images/dest-finland.jpg';
  if (lower.includes('canada') || lower.includes('usa') || lower.includes('united states')) return '/images/dest-canada.jpg';
  if (lower.includes('poland') || lower.includes('czech')) return '/images/dest-poland.jpg';
  if (lower.includes('latvia') || lower.includes('lithuania')) return '/images/dest-latvia.jpg';
  if (lower.includes('france')) return '/images/dest-france.jpg';
  if (lower.includes('italy')) return '/images/dest-italy.jpg';
  if (lower.includes('spain') || lower.includes('portugal')) return '/images/dest-spain.jpg';
  if (lower.includes('malta') || lower.includes('cyprus') || lower.includes('greece')) {
    return '/images/dest-malta.jpg';
  }
  return '/images/dest-uk.jpg';
}

export const HELP_IMAGES = {
  counselor: '/images/help-counselor.jpg',
  students: '/images/help-students.jpg',
  guide: '/images/help-guide.jpg',
} as const;
