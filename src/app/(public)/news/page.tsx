'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Globe2,
  Calendar,
  ChevronLeft
} from 'lucide-react';

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
  'Australia',
  'Canada',
  'Latvia',
  'Denmark',
  'Ireland',
  'Malta',
  'Netherlands',
  'Sweden',
  'USA',
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Newspaper className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            Daily Study Abroad News &amp; Visa Updates
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live international education, student visa, tuition, and post-study work news updated automatically.
          </p>
        </div>

        <button
          onClick={() => loadNews(selectedCountry)}
          disabled={loading}
          className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Daily Feed'}
        </button>
      </div>

      {/* Country Filter Pills & Search */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {NEWS_COUNTRIES.map((c) => {
            const active = selectedCountry === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCountry(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-cyan-500/15'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter headlines by keyword or news source..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          {fetchedAt && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Last synced: {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Key Country Policy Highlights */}
      {filteredUpdates.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Key Visa, Stay-Back &amp; Fee Alerts ({selectedCountry})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredUpdates.map((item, idx) => (
              <div
                key={`${item.country}-${idx}`}
                className="glass-card rounded-2xl p-4 space-y-1.5 border border-indigo-500/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1">
                    <Globe2 className="w-3.5 h-3.5" />
                    {item.country}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.summary}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live Daily News Articles */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-cyan-500" />
          Latest Headlines ({filteredArticles.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-5 animate-pulse space-y-3">
                <div className="h-3 w-32 bg-slate-200 dark:bg-white/10 rounded" />
                <div className="h-5 w-full bg-slate-200 dark:bg-white/10 rounded" />
                <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-xs text-slate-500">
            No live headlines matched that filter. Try clicking Refresh or selecting All Countries.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredArticles.map((article, idx) => (
              <a
                key={`${article.link}-${idx}`}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                      {article.source}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.pubDate)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors leading-snug">
                    {article.title}
                  </h3>
                </div>

                <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1">
                  Read Full Article <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
