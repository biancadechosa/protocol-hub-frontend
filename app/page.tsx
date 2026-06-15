'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchProtocols, createProtocol } from '@/lib/api';
import Link from 'next/link';

const SORT_OPTIONS = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Most Reviews', value: 'most_reviews' },
  { label: 'Highest Rated', value: 'highest_rated' },
  { label: 'Most Upvoted', value: 'most_upvoted' },
];

const TAGS = [
  'mental-health', 'mindfulness', 'healing', 'wellness', 'recovery',
  'sleep', 'stress-relief', 'focus', 'productivity', 'energy',
];

export default function Home() {
  const [protocols, setProtocols] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchProtocols({ search, sort, per_page: 100 });
        const docs = data.hits?.map((h: any) => h.document) ?? [];
        setProtocols(docs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, sort]);

  useEffect(() => {
    let mx = 0, my = 0, tx = 0, ty = 0;
    function onMove(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${mx - 5}px, ${my - 5}px)`;
      }
    }
    let raf: number;
    function animate() {
      tx += (mx - tx) * 0.12;
      ty += (my - ty) * 0.12;
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${tx - 14}px, ${ty - 14}px)`;
      }
      raf = requestAnimationFrame(animate);
    }
    window.addEventListener('mousemove', onMove);
    animate();
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  function clearFilters() {
    setSearch('');
    setSort('recent');
  }

  function toggleTag(tag: string) {
    setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleCreateProtocol(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newAuthor.trim()) return;
    setSubmitting(true);
    try {
      await createProtocol({ title: newTitle, content: newContent, author: newAuthor, tags: newTags });
      setNewTitle(''); setNewContent(''); setNewAuthor(''); setNewTags([]);
      setShowForm(false);
      const data = await fetchProtocols({ search, sort, per_page: 100 });
      setProtocols(data.hits?.map((h: any) => h.document) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const hasActiveFilters = search !== '' || sort !== 'recent';

  return (
    <div className="min-h-screen bg-[#F6F3ED] relative cursor-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        * { cursor: none !important; }

        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }

        .paper-grain {
          background-image: radial-gradient(circle at 1px 1px, rgba(27,58,43,0.04) 1px, transparent 0);
          background-size: 14px 14px;
        }

        .stem-card {
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .stem-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #3F6B4F;
          transform: scaleY(0.18);
          transform-origin: top;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .stem-card:hover::before {
          transform: scaleY(1);
        }
        .stem-card:hover {
          border-color: #3F6B4F;
          box-shadow: 0 8px 28px rgba(27,58,43,0.08);
          transform: translateY(-2px);
        }

        .stamp {
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, color 0.2s ease;
        }
        .stamp:active {
          transform: scale(0.85);
        }

        .tag-chip {
          transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
        }
        .tag-chip:hover {
          transform: translateY(-1px) rotate(-1deg);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; }

        .leaf-cursor {
          position: fixed;
          top: 0; left: 0;
          width: 10px; height: 10px;
          border-radius: 50% 0 50% 50%;
          background: #3F6B4F;
          pointer-events: none;
          z-index: 9999;
          transform: rotate(45deg);
        }
        .leaf-trail {
          position: fixed;
          top: 0; left: 0;
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 1px solid rgba(63,107,79,0.25);
          pointer-events: none;
          z-index: 9998;
        }

        @media (max-width: 1024px) {
          .leaf-cursor, .leaf-trail { display: none; }
          * { cursor: auto !important; }
        }
      `}</style>

      <div ref={cursorRef} className="leaf-cursor" />
      <div ref={trailRef} className="leaf-trail" />

      {/* Header */}
      <header className="border-b border-[#E8DFC9] bg-[#F6F3ED]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1B3A2B] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 21V10" stroke="#F6F3ED" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M12 14C12 14 6 13 6 7C12 7 12 14 12 14Z" fill="#F6F3ED" />
                <path d="M12 11C12 11 18 10 18 5C12 5 12 11 12 11Z" fill="#C97B4A" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold text-[#1B3A2B] tracking-tight leading-none">
                Protocol Hub
              </h1>
              <p className="text-xs font-mono text-[#8A9B8E] leading-none mt-1 tracking-wide">
                community wellness archive
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="w-full px-6 py-10 flex flex-col lg:flex-row gap-8 paper-grain">

        {/* Sidebar */}
        <aside className="lg:w-80 flex-shrink-0 flex flex-col gap-4 order-2 lg:order-1">
          <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 fade-up" style={{ animationDelay: '0.05s' }}>
            <p className="text-[10px] font-mono text-[#C97B4A] uppercase tracking-[0.2em] mb-2">field notes</p>
            <h3 className="text-lg font-display font-medium text-[#1B3A2B] mb-2">About this hub</h3>
            <p className="text-sm text-[#6B7B6E] leading-relaxed font-body">
              A growing collection of structured wellness and healing protocols, planted, tended, and refined by the people who use them.
            </p>
          </div>

          <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 fade-up" style={{ animationDelay: '0.1s' }}>
            <p className="text-[10px] font-mono text-[#C97B4A] uppercase tracking-[0.2em] mb-3">browse by tag</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearch(tag)}
                  className="tag-chip text-xs font-mono bg-[#F6F3ED] text-[#3F6B4F] px-3 py-1.5 rounded-full border border-[#E8DFC9] hover:bg-[#3F6B4F] hover:text-[#F6F3ED] hover:border-[#3F6B4F]"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 order-1 lg:order-2">
          <div className="flex items-center justify-between mb-3 fade-up">
            <h2 className="font-display text-xl font-medium text-[#1B3A2B]">Browse protocols</h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="stamp text-sm font-mono bg-[#1B3A2B] text-[#F6F3ED] px-4 py-2 rounded-xl hover:bg-[#3F6B4F] transition-colors"
            >
              {showForm ? 'Cancel' : '+ New protocol'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreateProtocol} className="bg-white border border-[#E8DFC9] rounded-2xl p-6 mb-4 flex flex-col gap-3 fade-up">
              <input
                type="text"
                placeholder="Protocol title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full border border-[#E8DFC9] rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] placeholder:text-[#B8C4BA]"
                required
              />
              <textarea
                placeholder="Protocol content / steps"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={5}
                className="w-full border border-[#E8DFC9] rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] placeholder:text-[#B8C4BA] resize-y"
                required
              />
              <input
                type="text"
                placeholder="Your name"
                value={newAuthor}
                onChange={e => setNewAuthor(e.target.value)}
                className="w-full border border-[#E8DFC9] rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] placeholder:text-[#B8C4BA]"
                required
              />
              <div>
                <p className="text-[10px] font-mono text-[#C97B4A] uppercase tracking-[0.2em] mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`tag-chip text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${newTags.includes(tag)
                        ? 'bg-[#3F6B4F] text-[#F6F3ED] border-[#3F6B4F]'
                        : 'bg-[#F6F3ED] text-[#3F6B4F] border-[#E8DFC9]'
                        }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="stamp self-end text-sm font-mono bg-[#1B3A2B] text-[#F6F3ED] px-5 py-2.5 rounded-xl hover:bg-[#3F6B4F] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Posting…' : 'Post protocol'}
              </button>
            </form>
          )}
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-2 fade-up">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A9B8E] text-sm font-mono">⌕</span>
              <input
                type="text"
                placeholder="search the archive..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-[#E8DFC9] rounded-xl pl-10 pr-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] placeholder:text-[#B8C4BA] transition-all"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="border border-[#E8DFC9] rounded-xl px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="border border-[#E8DFC9] rounded-xl px-4 py-3 text-sm font-body text-[#8A9B8E] bg-white hover:border-[#C97B4A] hover:text-[#C97B4A] transition-colors whitespace-nowrap"
              >
                clear ×
              </button>
            )}
          </div>

          {!loading && (
            <p className="text-xs font-mono text-[#B8C4BA] mb-6 tracking-wide">
              {String(protocols.length).padStart(2, '0')} protocol{protocols.length !== 1 ? 's' : ''}
              {hasActiveFilters && search && <> — filtered by &quot;{search}&quot;</>}
            </p>
          )}

          {/* Protocol Cards */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border border-[#E8DFC9] rounded-2xl p-6 animate-pulse bg-white w-full">
                  <div className="h-5 bg-[#F6F3ED] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-[#F6F3ED] rounded w-1/4 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-[#F6F3ED] rounded-full w-16" />
                    <div className="h-5 bg-[#F6F3ED] rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : protocols.length === 0 ? (
            <div className="text-center py-24 text-[#8A9B8E]">
              <p className="text-2xl font-display mb-2">Nothing growing here yet</p>
              <p className="text-sm font-body">
                Try a different search term or{' '}
                <button onClick={clearFilters} className="text-[#3F6B4F] hover:underline font-medium">
                  clear filters
                </button>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {protocols.map((protocol, i) => (
                <Link
                  key={protocol.id}
                  href={`/protocols/${protocol.id}`}
                  className="stem-card fade-up block w-full bg-white border border-[#E8DFC9] rounded-2xl pl-7 pr-6 py-5"
                  style={{ animationDelay: `${0.05 * i}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-display font-medium text-[#1B3A2B] group-hover:text-[#3F6B4F] transition-colors">
                        {protocol.title}
                      </h2>
                      <p className="text-xs font-mono text-[#B8C4BA] mt-1.5 tracking-wide">by {protocol.author}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {protocol.tags?.map((tag: string) => (
                          <span
                            key={tag}
                            className="text-xs font-mono bg-[#F6F3ED] text-[#3F6B4F] px-2.5 py-1 rounded-full border border-[#E8DFC9]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1 text-xs font-mono text-[#1B3A2B]">
                        <span className="text-[#C97B4A]">★</span>
                        <span className="font-medium">{protocol.rating?.toFixed(1)}</span>
                        <span className="text-[#B8C4BA]">/5</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#B8C4BA]">{protocol.reviews_count} reviews</div>
                      <div
                        className={`stamp text-[11px] font-mono px-2.5 py-1 rounded-full border ${protocol.upvotes_score >= 0
                          ? 'border-[#3F6B4F]/30 text-[#3F6B4F] bg-[#3F6B4F]/5'
                          : 'border-[#C97B4A]/30 text-[#C97B4A] bg-[#C97B4A]/5'
                          }`}
                      >
                        {protocol.upvotes_score > 0 ? '+' : ''}{protocol.upvotes_score} votes
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}