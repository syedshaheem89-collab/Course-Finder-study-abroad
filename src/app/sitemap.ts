import type { MetadataRoute } from 'next';
import { getAllDestinationSlugs, SITE_URL } from '@/lib/seo-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const destinationEntries: MetadataRoute.Sitemap = getAllDestinationSlugs().map((slug) => ({
    url: `${SITE_URL}/study-in/${slug}`,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/courses`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/enquiry`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/news`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...destinationEntries,
  ];
}
