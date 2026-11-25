'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  RefreshCw,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { getDestinationImage } from '@/lib/destination-media';

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  country: string;
}

interface PolicyUpdate {
  country: string;
  title: string;
  summary: string;
  tag: string;
}

const NEWS_COUNTRIES = [
  'All',
  'United Kingdom',
  'Germany',
  'Sweden',
  'Ireland',
  'Canada',
  'Australia',
  'Netherlands',
  'Poland',
  'France',
  'Malta',
  'Denmark',
  'Latvia',
  'Finland',
];

export default function StudyAbroadNewsPage() {
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [updates, setUpdates] = useState<PolicyUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchedAt, setFetchedAt] = useState<string>('');

  const loadNews = async (country: string) => {
    setLoading(true);
    try {
      const q = country && country !== 'All' ? `?country=${encodeURIComponent(country)}` : '';
      const res = await fetch(`/api/study-abroad-news${q}`);
      const data = await res.json();
      if (data.success) {
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setUpdates(Array.isArray(data.updates) ? data.updates : []);
        setFetchedAt(data.fetchedAt || '');
      }
    } catch (e) {
      console.error('Failed to load news:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews(selectedCountry);
  }, [selectedCountry]);

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const filteredUpdates = useMemo(() => {
    if (selectedCountry === 'All') return updates;
    const matched = updates.filter(
      (u) => u.country.toLowerCase() === selectedCountry.toLowerCase()
    );
    return matched.length > 0 ? matched : updates;
  }, [updates, selectedCountry]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Apple Newsroom Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/[0.06] dark:border-white/10 pb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white mb-3 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Newsroom &amp; Visa Updates
          </h1>
          <p className="text-[15px] text-[#6E6E73] dark:text-[#A1A1A6] mt-1.5">
            Live international education, student visa, tuition, and post-study work policy headlines.
          </p>
        </div>

        <button
          onClick={() => loadNews(selectedCountry)}
          disabled={loading}
          className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-[12px] font-medium flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6E6E73] ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Feed'}
        </button>
      </div>

      {/* Country Filter Pills & Minimal Search */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {NEWS_COUNTRIES.map((c) => {
            const active = selectedCountry === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCountry(c)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
                    : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#A1A1A6] border border-black/[0.06] dark:border-white/10 hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headlines or sources..."
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
          </div>
          {fetchedAt && (
            <span className="text-[12px] text-[#86868B]">
              Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Key Country Policy Highlights */}
      {filteredUpdates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#0071E3]" />
            Key Policy &amp; Visa Briefs ({selectedCountry})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredUpdates.map((item, idx) => (
              <div
                key={`${item.country}-${idx}`}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col"
              >
                <div className="relative h-28 w-full overflow-hidden bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                  <img
                    src={getDestinationImage(item.country)}
                    alt={`${item.country} university architecture`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                  <div className="absolute bottom-2.5 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-white tracking-tight">
                      {item.country}
                    </span>
                    <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white/90 text-[#1D1D1F]">
                      {item.tag}
                    </span>
                  </div>
                </div>
                <div className="p-5 space-y-2 flex-1">
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live Daily News Articles */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
          Latest Headlines ({filteredArticles.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 animate-pulse space-y-3"
              >
                <div className="h-3 w-32 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded" />
                <div className="h-5 w-full bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded" />
                <div className="h-3 w-24 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded" />
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-12 text-center text-[13px] text-[#6E6E73] border border-black/[0.06] dark:border-white/10">
            No live headlines matched that filter. Try clicking Refresh Feed or selecting All.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article, idx) => (
              <a
                key={`${article.link}-${idx}`}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B]">
                      {article.source}
                    </span>
                    <span className="text-[#86868B] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.pubDate)}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] transition-colors leading-snug">
                    {article.title}
                  </h3>
                </div>

                <span className="text-[13px] font-medium text-[#0066CC] dark:text-[#2997FF] inline-flex items-center gap-1">
                  Read Full Article <ChevronRight className="w-3.5 h-3.5" />
                  <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
