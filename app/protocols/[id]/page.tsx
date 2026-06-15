'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    fetchProtocol,
    fetchReviews,
    fetchThreads,
    fetchThread,
    createThread,
    createReview,
    castVote,
} from '@/lib/api';

function getUserId(): string {
    const stored = localStorage.getItem('user_id');
    if (stored) return stored;
    const id = Math.random().toString(36).slice(2);
    localStorage.setItem('user_id', id);
    return id;
}

function LeafUp({ active }: { active?: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
                d="M12 4C12 4 18 8 18 14C12 14 12 4 12 4Z"
                fill={active ? '#3F6B4F' : 'none'}
                stroke="#3F6B4F"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function LeafDown({ active }: { active?: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
                d="M12 20C12 20 18 16 18 10C12 10 12 20 12 20Z"
                fill={active ? '#C97B4A' : 'none'}
                stroke="#C97B4A"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function VoteRail({ score, userVote, onUpvote, onDownvote, disabled }: {
    score: number;
    userVote: 1 | -1 | 0;
    onUpvote: () => void;
    onDownvote: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-1.5 pt-1 bg-[#F6F3ED] rounded-xl px-2 py-2 border border-[#E8DFC9]">
            <button
                onClick={onUpvote}
                disabled={disabled}
                aria-label="Upvote"
                className={`stamp p-1.5 rounded-lg transition-colors ${userVote === 1 ? 'bg-[#3F6B4F]/15' : 'hover:bg-[#3F6B4F]/10'
                    } disabled:opacity-40`}
            >
                <LeafUp active={userVote === 1} />
            </button>
            <span className="font-mono text-sm font-semibold text-[#1B3A2B] tabular-nums">
                {score}
            </span>
            <button
                onClick={onDownvote}
                disabled={disabled}
                aria-label="Downvote"
                className={`stamp p-1.5 rounded-lg transition-colors ${userVote === -1 ? 'bg-[#C97B4A]/15' : 'hover:bg-[#C97B4A]/10'
                    } disabled:opacity-40`}
            >
                <LeafDown active={userVote === -1} />
            </button>
        </div>
    );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hovered, setHovered] = useState(0);
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="text-2xl transition-colors"
                    style={{ color: star <= (hovered || value) ? '#C97B4A' : '#E8DFC9' }}
                >★</button>
            ))}
        </div>
    );
}

const inputClass = "w-full border border-[#E8DFC9] rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#3F6B4F]/30 focus:border-[#3F6B4F] bg-white text-[#1B3A2B] placeholder:text-[#B8C4BA] transition-all";

export default function ProtocolDetail() {
    const { id } = useParams();
    const router = useRouter();
    const cursorRef = useRef<HTMLDivElement>(null);
    const trailRef = useRef<HTMLDivElement>(null);

    const [protocol, setProtocol] = useState<any>(null);
    const [threads, setThreads] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showThreadForm, setShowThreadForm] = useState(false);
    const [threadTitle, setThreadTitle] = useState('');
    const [threadBody, setThreadBody] = useState('');
    const [threadAuthor, setThreadAuthor] = useState('');
    const [submittingThread, setSubmittingThread] = useState(false);

    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [reviewAuthor, setReviewAuthor] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const [p, r, t] = await Promise.all([
                    fetchProtocol(Number(id)),
                    fetchReviews(Number(id)),
                    fetchThreads({ protocol_id: Number(id), sort: 'recent', per_page: 50 }),
                ]);
                setProtocol(p);
                setReviews(r);
                setThreads(t.hits?.map((h: any) => h.document) ?? []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

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

    async function handleVoteThread(threadId: number, value: 1 | -1) {
        const userId = getUserId();
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, _voting: true } : t));
        try {
            await castVote({ votable_type: 'thread', votable_id: threadId, value, user_identifier: userId });
            const fresh = await fetchThread(threadId);
            const freshScore = Array.isArray(fresh.votes)
                ? fresh.votes.reduce((s: number, v: any) => s + (v.value ?? 0), 0)
                : 0;
            setThreads(prev => prev.map(t => t.id === threadId
                ? { ...t, upvotes_score: freshScore, _voting: false }
                : t
            ));
        } catch (e) {
            console.error(e);
            setThreads(prev => prev.map(t => t.id === threadId ? { ...t, _voting: false } : t));
        }
    }

    async function handleSubmitThread(e: React.FormEvent) {
        e.preventDefault();
        if (!threadTitle.trim() || !threadBody.trim() || !threadAuthor.trim()) return;
        setSubmittingThread(true);
        try {
            await createThread(Number(id), { title: threadTitle, body: threadBody, author: threadAuthor });
            setThreadTitle(''); setThreadBody(''); setThreadAuthor('');
            setShowThreadForm(false);
            const t = await fetchThreads({ protocol_id: Number(id), sort: 'recent', per_page: 50 });
            setThreads(t.hits?.map((h: any) => h.document) ?? []);
        } finally {
            setSubmittingThread(false);
        }
    }

    async function handleSubmitReview(e: React.FormEvent) {
        e.preventDefault();
        if (!reviewRating || !reviewAuthor.trim()) return;
        setSubmittingReview(true);
        try {
            await createReview(Number(id), { rating: reviewRating, feedback: reviewFeedback, author: reviewAuthor });
            setReviewRating(0); setReviewFeedback(''); setReviewAuthor('');
            setShowReviewForm(false);
            const [r, p] = await Promise.all([fetchReviews(Number(id)), fetchProtocol(Number(id))]);
            setReviews(r);
            setProtocol(p);
        } finally {
            setSubmittingReview(false);
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-[#F6F3ED] px-6 py-10">
            <div className="w-full">
                <div className="h-7 bg-white rounded w-1/3 mb-3 animate-pulse" />
                <div className="h-4 bg-white rounded w-1/5 mb-8 animate-pulse" />
                <div className="h-32 bg-white rounded-2xl animate-pulse" />
            </div>
        </div>
    );

    if (!protocol) return (
        <div className="min-h-screen bg-[#F6F3ED] px-6 py-10 text-center">
            <p className="text-[#8A9B8E] font-body mb-2">This protocol could not be found.</p>
            <Link href="/" className="text-[#3F6B4F] text-sm font-medium hover:underline">← Back to protocols</Link>
        </div>
    );

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
        .stem-card:hover::before { transform: scaleY(1); }
        .stem-card:hover {
          border-color: #3F6B4F;
          box-shadow: 0 8px 28px rgba(27,58,43,0.08);
          transform: translateY(-2px);
        }
        .stamp {
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
        }
        .stamp:active { transform: scale(0.8); }
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
                            <Link href="/" className="text-xl font-display font-semibold text-[#1B3A2B] tracking-tight leading-none hover:text-[#3F6B4F] transition-colors">
                                Protocol Hub
                            </Link>
                            <p className="text-xs font-mono text-[#8A9B8E] leading-none mt-1 tracking-wide">
                                community wellness archive
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="text-sm font-body font-medium text-[#3F6B4F] hover:text-[#1B3A2B] transition-colors"
                    >
                        ← Back
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="w-full px-6 py-10 flex flex-col lg:flex-row gap-8 paper-grain">

                {/* Main feed */}
                <main className="flex-1 min-w-0 order-1">
                    {/* Protocol header card */}
                    <div className="bg-white border border-[#E8DFC9] rounded-2xl p-7 mb-6 fade-up">
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl font-display font-semibold text-[#1B3A2B] mb-1">
                                    {protocol.title}
                                </h1>
                                <p className="text-xs font-mono text-[#B8C4BA] tracking-wide">by {protocol.author}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-mono text-[#1B3A2B] shrink-0">
                                <span className="text-[#C97B4A]">★</span>
                                <span className="font-medium">{Number(protocol.rating).toFixed(1)}</span>
                                <span className="text-[#B8C4BA]">/5 · {reviews.length} reviews</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-5">
                            {(Array.isArray(protocol.tags) ? protocol.tags : []).map((tag: string) => (
                                <span key={tag} className="text-xs font-mono bg-[#F6F3ED] text-[#3F6B4F] px-2.5 py-1 rounded-full border border-[#E8DFC9]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <div className="border-t border-[#E8DFC9] pt-4 text-sm font-body text-[#4A5A4D] leading-relaxed whitespace-pre-line">
                            {protocol.content}
                        </div>
                    </div>

                    {/* Threads feed header */}
                    <div className="flex items-center justify-between mb-3 fade-up" style={{ animationDelay: '0.05s' }}>
                        <h2 className="text-sm font-mono text-[#8A9B8E] uppercase tracking-[0.2em]">
                            discussions · {threads.length}
                        </h2>
                        <button
                            onClick={() => setShowThreadForm(v => !v)}
                            className="text-sm font-body font-medium text-[#3F6B4F] border border-[#3F6B4F]/30 rounded-lg px-3 py-1.5 hover:bg-[#3F6B4F]/8 transition-colors"
                        >
                            {showThreadForm ? 'Cancel' : '+ Start a thread'}
                        </button>
                    </div>

                    {/* New thread form */}
                    {showThreadForm && (
                        <form onSubmit={handleSubmitThread} className="bg-white border border-[#E8DFC9] rounded-2xl p-5 mb-4 flex flex-col gap-3 fade-up">
                            <input
                                className={inputClass}
                                placeholder="Thread title"
                                value={threadTitle}
                                onChange={e => setThreadTitle(e.target.value)}
                                required
                            />
                            <textarea
                                className={`${inputClass} min-h-[100px] resize-y`}
                                placeholder="What's on your mind?"
                                value={threadBody}
                                onChange={e => setThreadBody(e.target.value)}
                                required
                            />
                            <input
                                className={inputClass}
                                placeholder="Your name"
                                value={threadAuthor}
                                onChange={e => setThreadAuthor(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                disabled={submittingThread}
                                className="self-end bg-[#1B3A2B] text-[#F6F3ED] text-sm font-medium rounded-lg px-4 py-2 hover:bg-[#3F6B4F] transition-colors disabled:opacity-60"
                            >
                                {submittingThread ? 'Posting...' : 'Post thread'}
                            </button>
                        </form>
                    )}

                    {/* Thread list */}
                    <div className="flex flex-col gap-3">
                        {threads.length === 0 ? (
                            <div className="text-center py-16 text-[#8A9B8E]">
                                <p className="text-lg font-display mb-1">Quiet here for now</p>
                                <p className="text-sm font-body">Be the first to start a discussion.</p>
                            </div>
                        ) : (
                            threads.map((thread, i) => (
                                <div
                                    key={thread.id}
                                    className="stem-card fade-up bg-white border border-[#E8DFC9] rounded-2xl pl-7 pr-5 py-4 flex gap-4"
                                    style={{ animationDelay: `${0.04 * i}s` }}
                                >
                                    <VoteRail
                                        score={thread.upvotes_score ?? 0}
                                        userVote={thread._userVote ?? 0}
                                        disabled={thread._voting}
                                        onUpvote={() => handleVoteThread(thread.id, 1)}
                                        onDownvote={() => handleVoteThread(thread.id, -1)}
                                    />
                                    <Link href={`/threads/${thread.id}`} className="flex-1 min-w-0">
                                        <h3 className="text-base font-display font-medium text-[#1B3A2B] mb-1 hover:text-[#3F6B4F] transition-colors">
                                            {thread.title}
                                        </h3>
                                        <p className="text-sm font-body text-[#8A9B8E]">
                                            {thread.body?.slice(0, 160)}{thread.body?.length > 160 ? '...' : ''}
                                        </p>
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                </main>

                {/* Sidebar: reviews */}
                <aside className="lg:w-80 flex-shrink-0 flex flex-col gap-4 order-2">
                    <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 fade-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-mono text-[#C97B4A] uppercase tracking-[0.2em]">
                                reviews · {reviews.length}
                            </p>
                            <button
                                onClick={() => setShowReviewForm(v => !v)}
                                className="text-xs font-body font-medium text-[#3F6B4F] hover:text-[#1B3A2B] transition-colors"
                            >
                                {showReviewForm ? 'Cancel' : '+ Write one'}
                            </button>
                        </div>

                        {showReviewForm && (
                            <form onSubmit={handleSubmitReview} className="flex flex-col gap-3 mb-4 pb-4 border-b border-[#E8DFC9]">
                                <StarRating value={reviewRating} onChange={setReviewRating} />
                                <textarea
                                    className={`${inputClass} min-h-[70px] resize-y text-xs`}
                                    placeholder="Share your experience (optional)"
                                    value={reviewFeedback}
                                    onChange={e => setReviewFeedback(e.target.value)}
                                />
                                <input
                                    className={`${inputClass} text-xs`}
                                    placeholder="Your name"
                                    value={reviewAuthor}
                                    onChange={e => setReviewAuthor(e.target.value)}
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={submittingReview || !reviewRating}
                                    className="self-end bg-[#1B3A2B] text-[#F6F3ED] text-xs font-medium rounded-lg px-3 py-1.5 hover:bg-[#3F6B4F] transition-colors disabled:opacity-60"
                                >
                                    {submittingReview ? 'Submitting...' : 'Submit'}
                                </button>
                            </form>
                        )}

                        {reviews.length === 0 ? (
                            <p className="text-sm font-body text-[#B8C4BA] text-center py-4">No reviews yet.</p>
                        ) : (
                            <div className="flex flex-col gap-4 max-h-[520px] overflow-y-auto pr-1">
                                {reviews.map((review, i) => (
                                    <div key={review.id} className="fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-body font-medium text-[#1B3A2B]">{review.author}</span>
                                            <span className="text-xs" style={{ color: '#C97B4A' }}>
                                                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                            </span>
                                        </div>
                                        {review.feedback && (
                                            <p className="text-sm font-body text-[#8A9B8E] leading-relaxed">{review.feedback}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}