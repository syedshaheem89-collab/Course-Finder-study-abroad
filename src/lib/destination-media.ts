import { normalizeCountryName } from './countries';

/**
 * Iconic landmark photographs hosted under public/images/
 * for verified destinations. Other countries render clean typography instead of mismatched landmarks.
 */
export const EXACT_DESTINATION_IMAGES: Record<string, string> = {
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
};

export function getExactDestinationImage(country?: string): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (EXACT_DESTINATION_IMAGES[trimmed]) return EXACT_DESTINATION_IMAGES[trimmed];
  const normalized = normalizeCountryName(trimmed);
  if (normalized && EXACT_DESTINATION_IMAGES[normalized]) {
    return EXACT_DESTINATION_IMAGES[normalized];
  }
  return null;
}

export function getDestinationImage(country?: string): string {
  return getExactDestinationImage(country) || '/images/dest-uk.jpg';
}

export const HELP_IMAGES = {
  counselor: '/images/help-counselor.jpg',
  students: '/images/help-students.jpg',
  guide: '/images/help-guide.jpg',
} as const;
