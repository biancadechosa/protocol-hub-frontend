'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchThread, fetchComments, castVote, createComment, createReply } from '@/lib/api';

// Safe client-only USER_ID — never runs on server
function getUserId(): string {
    const stored = localStorage.getItem('user_id');
    if (stored) return stored;
    const id = Math.random().toString(36).slice(2);
    localStorage.setItem('user_id', id);
    return id;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Thread {
    id: number;
    title: string;
    body: string;
    author?: string;
    created_at?: string;
    upvotes_score: number;
    protocol_id?: number;
    protocol?: { id: number; title: string };
    _userVote?: 1 | -1 | 0;
    _voting?: boolean;
}

interface Comment {
    id: number;
    body: string;
    author?: string;
    created_at?: string;
    upvotes_score: number;
    parent_id: number | null;
    children?: Comment[];
    _userVote?: 1 | -1 | 0;
    _voting?: boolean;
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// ThreadController::show returns votes as a relation array [{value: 1}, ...],
// not a computed upvotes_score field. Compute it here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeThread(raw: any): Thread {
    const computedScore = Array.isArray(raw.votes)
        ? raw.votes.reduce((sum: number, v: any) => sum + (v.value ?? 0), 0)
        : 0;
    const upvotes_score = raw.upvotes_score ?? computedScore;
    return {
        ...raw,
        upvotes_score,
        protocol_id: raw.protocol_id ?? raw.protocol?.id,
        _userVote: 0,
        _voting: false,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeComment(cm: any): Comment {
    const computedScore = Array.isArray(cm.votes)
        ? cm.votes.reduce((sum: number, v: any) => sum + (v.value ?? 0), 0)
        : 0;
    return {
        ...cm,
        body: cm.body ?? cm.content ?? '',
        upvotes_score: cm.upvotes_score ?? computedScore,
        parent_id: cm.parent_id ?? null,
        _userVote: 0,
        _voting: false,
        children: (cm.replies ?? cm.children ?? []).map(normalizeComment),
    };
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

function LeafUp({ active, size = 20 }: { active?: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
                d="M12 5C12 5 5 9 5 15C9 15 12 12 12 12C12 12 15 15 19 15C19 9 12 5 12 5Z"
                fill={active ? '#3F6B4F' : 'none'}
                stroke={active ? '#3F6B4F' : '#8A9B8E'}
                strokeWidth="1.5" strokeLinejoin="round"
            />
            <path d="M12 12V20" stroke={active ? '#3F6B4F' : '#8A9B8E'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function LeafDown({ active, size = 20 }: { active?: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
                d="M12 19C12 19 5 15 5 9C9 9 12 12 12 12C12 12 15 9 19 9C19 15 12 19 12 19Z"
                fill={active ? '#C97B4A' : 'none'}
                stroke={active ? '#C97B4A' : '#8A9B8E'}
                strokeWidth="1.5" strokeLinejoin="round"
            />
            <path d="M12 12V4" stroke={active ? '#C97B4A' : '#8A9B8E'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function SproutLogo() {
    return (
        <div className="w-10 h-10 rounded-lg bg-[#1B3A2B] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 21V10" stroke="#F6F3ED" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M12 14C12 14 6 13 6 7C12 7 12 14 12 14Z" fill="#F6F3ED" />
                <path d="M12 11C12 11 18 10 18 5C12 5 12 11 12 11Z" fill="#C97B4A" />
            </svg>
        </div>
    );
}

// ── Vote Rail (vertical box - used for thread + top-level comments) ───────────

function VoteRail({ score, userVote, onUpvote, onDownvote, disabled, size = 'md' }: {
    score: number;
    userVote: 1 | -1 | 0;
    onUpvote: () => void;
    onDownvote: () => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}) {
    return (
        <div className={`flex flex-col items-center ${size === 'sm'
            ? 'gap-0.5 px-0.5 py-0.5'
            : 'gap-1.5 bg-[#F6F3ED] rounded-xl border border-[#E8DFC9] px-2 py-2'
            }`}>
            <button onClick={onUpvote} disabled={disabled} aria-label="Upvote"
                className={`stamp rounded-lg transition-colors ${size === 'sm' ? 'p-0.5' : 'p-1'} ${userVote === 1 ? 'bg-[#3F6B4F]/15' : 'hover:bg-[#3F6B4F]/10'} disabled:opacity-40`}>
                <LeafUp active={userVote === 1} size={size === 'sm' ? 16 : 20} />
            </button>
            <span className={`font-mono font-semibold text-[#1B3A2B] tabular-nums ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                {score}
            </span>
            <button onClick={onDownvote} disabled={disabled} aria-label="Downvote"
                className={`stamp rounded-lg transition-colors ${size === 'sm' ? 'p-0.5' : 'p-1'} ${userVote === -1 ? 'bg-[#C97B4A]/15' : 'hover:bg-[#C97B4A]/10'} disabled:opacity-40`}>
                <LeafDown active={userVote === -1} size={size === 'sm' ? 16 : 20} />
            </button>
        </div>
    );
}

// ── Inline Vote (horizontal, compact - used for nested replies) ───────────────

function InlineVote({ score, userVote, onUpvote, onDownvote, disabled }: {
    score: number;
    userVote: 1 | -1 | 0;
    onUpvote: () => void;
    onDownvote: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onUpvote} disabled={disabled} aria-label="Upvote"
                className={`stamp p-0.5 rounded-md transition-colors ${userVote === 1 ? 'bg-[#3F6B4F]/15' : 'hover:bg-[#3F6B4F]/10'} disabled:opacity-40`}>
                <LeafUp active={userVote === 1} size={14} />
            </button>
            <span className="font-mono text-xs font-semibold text-[#1B3A2B] tabular-nums min-w-[1ch] text-center">
                {score}
            </span>
            <button onClick={onDownvote} disabled={disabled} aria-label="Downvote"
                className={`stamp p-0.5 rounded-md transition-colors ${userVote === -1 ? 'bg-[#C97B4A]/15' : 'hover:bg-[#C97B4A]/10'} disabled:opacity-40`}>
                <LeafDown active={userVote === -1} size={14} />
            </button>
        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nestComments(flat: Comment[]): Comment[] {
    // API already returns nested via replies relation — if children are populated, use as-is
    const hasNesting = flat.some(c => c.children && c.children.length > 0);
    if (hasNesting) return flat.filter(c => c.parent_id === null || c.parent_id === undefined);

    // Fallback: manually nest by parent_id
    const map = new Map<number, Comment>();
    const roots: Comment[] = [];
    flat.forEach(c => map.set(c.id, { ...c, children: [] }));
    map.forEach(c => {
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id)!.children!.push(c);
        } else {
            roots.push(c);
        }
    });
    return roots;
}

function timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function updateCommentInTree(comments: Comment[], id: number, updater: (c: Comment) => Comment): Comment[] {
    return comments.map(c => {
        if (c.id === id) return updater(c);
        if (c.children?.length) return { ...c, children: updateCommentInTree(c.children, id, updater) };
        return c;
    });
}

function flattenComments(comments: Comment[]): Comment[] {
    return comments.flatMap(c => [c, ...flattenComments(c.children ?? [])]);
}

function countComments(comments: Comment[]): number {
    return flattenComments(comments).length;
}

// ── Comment Node ─────────────────────────────────────────────────────────────
// Reddit-style nesting: only top-level comments (depth 0) get the full vertical
// vote rail as a separate column. Replies (depth > 0) use a thin connecting
// line for nesting indication plus a compact inline vote control next to the
// author row — this avoids vote rails compounding indentation on narrow
// screens while still showing nesting depth clearly.

function CommentNode({ comment, depth, onVote, onReply }: {
    comment: Comment;
    depth: number;
    onVote: (id: number, value: 1 | -1) => void;
    onReply: (parentId: number, body: string, author: string) => Promise<void>;
}) {
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [replyAuthor, setReplyAuthor] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleReplySubmit() {
        if (!replyBody.trim()) return;
        setSubmitting(true);
        await onReply(comment.id, replyBody.trim(), replyAuthor.trim() || 'Anonymous');
        setReplyBody('');
        setReplyAuthor('');
        setReplyOpen(false);
        setSubmitting(false);
    }

    const depthColors = ['#3F6B4F', '#C97B4A', '#8A9B8E', '#B8C4BA'];
    const accentColor = depthColors[Math.min(depth, depthColors.length - 1)];
    const isTopLevel = depth === 0;

    const cardContent = (
        <div className="bg-white rounded-xl border border-[#E8DFC9] px-2.5 sm:px-4 py-2.5 sm:py-3 comment-card min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: accentColor }}>
                    {(comment.author ?? 'A')[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-[#1B3A2B] truncate max-w-[120px] sm:max-w-none">{comment.author ?? 'Anonymous'}</span>
                <span className="text-xs text-[#B8C4BA] font-mono whitespace-nowrap">{timeAgo(comment.created_at)}</span>

                {/* Inline vote control for nested replies — sits in the header row */}
                {!isTopLevel && (
                    <div className="ml-auto">
                        <InlineVote
                            score={comment.upvotes_score ?? 0}
                            userVote={comment._userVote ?? 0}
                            disabled={comment._voting}
                            onUpvote={() => onVote(comment.id, 1)}
                            onDownvote={() => onVote(comment.id, -1)}
                        />
                    </div>
                )}
            </div>
            <p className="text-sm text-[#2E4D3A] leading-relaxed">{comment.body}</p>
            <button onClick={() => setReplyOpen(v => !v)}
                className="mt-2 text-xs text-[#8A9B8E] hover:text-[#3F6B4F] transition-colors font-medium">
                {replyOpen ? '✕ Cancel' : '↩ Reply'}
            </button>
        </div>
    );

    const replyFormAndChildren = (
        <>
            {replyOpen && (
                <div className="mt-2 ml-1 fade-up space-y-2">
                    <input
                        value={replyAuthor}
                        onChange={e => setReplyAuthor(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full rounded-xl border border-[#E8DFC9] bg-white px-3 py-2 text-sm text-[#1B3A2B] placeholder-[#B8C4BA] focus:outline-none focus:border-[#3F6B4F]"
                    />
                    <textarea
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        placeholder="Write your reply…"
                        rows={3}
                        className="w-full rounded-xl border border-[#E8DFC9] bg-white px-3 py-2 text-sm text-[#1B3A2B] placeholder-[#B8C4BA] focus:outline-none focus:border-[#3F6B4F] resize-none"
                    />
                    <button onClick={handleReplySubmit}
                        disabled={submitting || !replyBody.trim()}
                        className="px-4 py-1.5 rounded-lg bg-[#1B3A2B] text-[#F6F3ED] text-xs font-medium hover:bg-[#3F6B4F] transition-colors disabled:opacity-50">
                        {submitting ? 'Posting…' : 'Post reply'}
                    </button>
                </div>
            )}

            {comment.children && comment.children.length > 0 && (
                <div>
                    {comment.children.map(child => (
                        <CommentNode key={child.id} comment={child} depth={depth + 1} onVote={onVote} onReply={onReply} />
                    ))}
                </div>
            )}
        </>
    );

    if (isTopLevel) {
        // Top-level: full vertical vote rail as its own column, no indentation
        return (
            <div className="flex gap-1.5 sm:gap-3 flex-1 min-w-0 mt-4">
                <div className="flex-shrink-0">
                    <VoteRail
                        score={comment.upvotes_score ?? 0}
                        userVote={comment._userVote ?? 0}
                        disabled={comment._voting}
                        onUpvote={() => onVote(comment.id, 1)}
                        onDownvote={() => onVote(comment.id, -1)}
                        size="sm"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    {cardContent}
                    {replyFormAndChildren}
                </div>
            </div>
        );
    }

    // Nested reply: minimal/no indentation, just a thin connecting line.
    // Vote control moves inline into the card header (see InlineVote above).
    return (
        <div className="flex gap-2 mt-3">
            <div className="w-px self-stretch rounded-full flex-shrink-0 mt-1 ml-1"
                style={{ backgroundColor: accentColor, opacity: 0.35 }} />
            <div className="flex-1 min-w-0">
                {cardContent}
                {replyFormAndChildren}
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ThreadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const threadId = Number(params.id);

    const [thread, setThread] = useState<Thread | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [newCommentAuthor, setNewCommentAuthor] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const cursorRef = useRef<HTMLDivElement>(null);
    const trailRef = useRef<HTMLDivElement>(null);

    // ── Cursor (consistent with all pages) ───────────────────────────────────
    useEffect(() => {
        let mx = 0, my = 0, tx = 0, ty = 0;
        function onMove(e: MouseEvent) {
            mx = e.clientX; my = e.clientY;
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate(${mx - 5}px, ${my - 5}px) rotate(-45deg)`;
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
        return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
    }, []);

    // ── Load thread + comments ────────────────────────────────────────────────
    useEffect(() => {
        if (!threadId) return;
        setLoading(true);
        Promise.all([fetchThread(threadId), fetchComments(threadId)])
            .then(([t, c]) => {
                setThread(normalizeThread(t));
                setComments((c ?? []).map(normalizeComment));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [threadId]);

    // ── Thread vote ───────────────────────────────────────────────────────────
    async function handleVoteThread(value: 1 | -1) {
        if (!thread || thread._voting) return;
        setThread(prev => prev ? { ...prev, _voting: true } : prev);
        try {
            const userId = getUserId();
            await castVote({ votable_type: 'thread', votable_id: thread.id, value, user_identifier: userId });
            const fresh = await fetchThread(thread.id);
            const freshScore = Array.isArray(fresh.votes)
                ? fresh.votes.reduce((s: number, v: any) => s + (v.value ?? 0), 0)
                : 0;
            setThread(prev => prev ? { ...prev, upvotes_score: freshScore, _voting: false } : prev);
        } catch (e) {
            console.error(e);
            setThread(prev => prev ? { ...prev, _voting: false } : prev);
        }
    }

    // ── Comment vote ──────────────────────────────────────────────────────────
    const handleVoteComment = useCallback(async (commentId: number, value: 1 | -1) => {
        setComments(prev => updateCommentInTree(prev, commentId, c => ({ ...c, _voting: true })));
        try {
            const userId = getUserId();
            await castVote({ votable_type: 'comment', votable_id: commentId, value, user_identifier: userId });
            const fresh = await fetchComments(threadId);
            setComments((fresh ?? []).map(normalizeComment));
        } catch (e) {
            console.error(e);
            setComments(prev => updateCommentInTree(prev, commentId, c => ({ ...c, _voting: false })));
        }
    }, [threadId]);

    // ── Reply ─────────────────────────────────────────────────────────────────
    const handleReply = useCallback(async (parentId: number, body: string, author: string) => {
        try {
            const newCm = await createReply(parentId, { content: body, author });
            const normalized = normalizeComment(newCm);
            setComments(prev => updateCommentInTree(prev, parentId, parent => ({
                ...parent,
                children: [...(parent.children ?? []), normalized],
            })));
        } catch (e) {
            console.error(e);
        }
    }, []);

    // ── Top-level comment ─────────────────────────────────────────────────────
    async function handleSubmitComment() {
        if (!newComment.trim()) return;
        setSubmittingComment(true);
        try {
            const author = newCommentAuthor.trim() || 'Anonymous';
            const newCm = await createComment(threadId, { content: newComment.trim(), author });
            setComments(prev => [...prev, normalizeComment(newCm)]);
            setNewComment('');
            setNewCommentAuthor('');
        } catch (e) {
            console.error(e);
        } finally {
            setSubmittingComment(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    const nestedComments = nestComments(comments);
    const totalComments = countComments(comments);

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        html, body { width: 100%; max-width: 100vw; overflow-x: hidden; }
        body { background-color: #F6F3ED; font-family: 'Inter', sans-serif; color: #1B3A2B; }

        .font-display { font-family: 'Fraunces', serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }

        body::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0;
        }

        .comment-card { transition: box-shadow 0.2s ease; }
        .comment-card:hover { box-shadow: 0 2px 12px rgba(27,58,43,0.07); }

        .stamp { transition: transform 0.12s ease; }
        .stamp:active { transform: scale(0.85); }

        .fade-up { animation: fadeUp 0.35s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .thread-body { line-height: 1.75; }

        @media (pointer: fine) { * { cursor: none !important; } }
      `}</style>

            <div ref={cursorRef} style={{ position: 'fixed', top: 0, left: 0, width: 10, height: 10, borderRadius: '50% 0 50% 0', background: '#3F6B4F', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-100px,-100px) rotate(-45deg)', willChange: 'transform' }} />
            <div ref={trailRef} style={{ position: 'fixed', top: 0, left: 0, width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #3F6B4F55', pointerEvents: 'none', zIndex: 9998, transform: 'translate(-100px,-100px)', willChange: 'transform' }} />

            <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>

                {/* Header */}
                <header className="sticky top-0 z-50 w-full bg-[#F6F3ED]/90 backdrop-blur-md border-b border-[#E8DFC9]">
                    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                        <div className="flex items-center justify-between px-6 h-14">
                            <Link href="/" className="flex items-center gap-2.5">
                                <SproutLogo />
                                <div>
                                    <div className="font-display font-semibold text-[#1B3A2B] text-base leading-none">Protocol Hub</div>
                                    <div className="text-[10px] text-[#8A9B8E] font-mono tracking-wide mt-0.5">Community Wellness</div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }}>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 mb-6 fade-up">
                        <button onClick={() => router.back()}
                            className="flex items-center gap-1.5 text-sm text-[#8A9B8E] hover:text-[#3F6B4F] transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Back
                        </button>
                        {thread?.protocol && (
                            <>
                                <span className="text-[#E8DFC9]">/</span>
                                <Link href={`/protocols/${thread.protocol.id}`}
                                    className="text-sm text-[#8A9B8E] hover:text-[#3F6B4F] transition-colors truncate max-w-[200px]">
                                    {thread.protocol.title}
                                </Link>
                            </>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <svg className="animate-spin w-8 h-8 text-[#3F6B4F]" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="text-sm text-[#8A9B8E] font-mono">Loading thread…</span>
                        </div>
                    ) : !thread ? (
                        <div className="text-center py-24 text-[#8A9B8E]">Thread not found.</div>
                    ) : (
                        <div className="flex gap-8 items-start">

                            {/* Main column */}
                            <div className="flex-1 min-w-0">

                                {/* Thread card */}
                                <div className="bg-white rounded-2xl border border-[#E8DFC9] overflow-hidden fade-up" style={{ animationDelay: '0.05s' }}>
                                    <div className="flex gap-4 p-6">
                                        <div className="flex-shrink-0">
                                            <VoteRail
                                                score={thread.upvotes_score}
                                                userVote={thread._userVote ?? 0}
                                                disabled={thread._voting}
                                                onUpvote={() => handleVoteThread(1)}
                                                onDownvote={() => handleVoteThread(-1)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h1 className="font-display font-semibold text-2xl text-[#1B3A2B] leading-snug mb-3">
                                                {thread.title}
                                            </h1>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-7 h-7 rounded-full bg-[#3F6B4F] flex items-center justify-center text-xs font-semibold text-white">
                                                    {(thread.author ?? 'A')[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-[#1B3A2B]">{thread.author ?? 'Anonymous'}</span>
                                                <span className="text-xs text-[#B8C4BA] font-mono">{timeAgo(thread.created_at)}</span>
                                            </div>
                                            <div className="thread-body text-[#2E4D3A] text-base whitespace-pre-wrap">
                                                {thread.body}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-[#E8DFC9] px-6 py-3 bg-[#FAFAF8]">
                                        <span className="font-mono text-xs text-[#8A9B8E]">
                                            {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
                                        </span>
                                    </div>
                                </div>

                                {/* New comment form */}
                                <div className="bg-white rounded-2xl border border-[#E8DFC9] p-5 mt-5 fade-up" style={{ animationDelay: '0.1s' }}>
                                    <h3 className="font-display font-semibold text-[#1B3A2B] text-base mb-4">Add a comment</h3>
                                    <div className="space-y-3">
                                        <input
                                            value={newCommentAuthor}
                                            onChange={e => setNewCommentAuthor(e.target.value)}
                                            placeholder="Your name (optional — defaults to Anonymous)"
                                            className="w-full rounded-xl border border-[#E8DFC9] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1B3A2B] placeholder-[#B8C4BA] focus:outline-none focus:border-[#3F6B4F] transition-colors"
                                        />
                                        <textarea
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder="Share your thoughts, experience, or questions…"
                                            rows={4}
                                            className="w-full rounded-xl border border-[#E8DFC9] bg-[#FAFAF8] px-4 py-3 text-sm text-[#1B3A2B] placeholder-[#B8C4BA] focus:outline-none focus:border-[#3F6B4F] resize-none transition-colors"
                                        />
                                        <div className="flex justify-end">
                                            <button onClick={handleSubmitComment}
                                                disabled={submittingComment || !newComment.trim()}
                                                className="stamp px-5 py-2 rounded-xl bg-[#1B3A2B] text-[#F6F3ED] text-sm font-medium hover:bg-[#3F6B4F] transition-colors disabled:opacity-50">
                                                {submittingComment ? 'Posting…' : 'Post comment'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Comments */}
                                <div className="mt-6 fade-up" style={{ animationDelay: '0.15s' }}>
                                    {nestedComments.length === 0 ? (
                                        <div className="text-center py-12 text-[#8A9B8E] text-sm">
                                            No comments yet — be the first to share your experience.
                                        </div>
                                    ) : (
                                        nestedComments.map(comment => (
                                            <CommentNode key={comment.id} comment={comment} depth={0} onVote={handleVoteComment} onReply={handleReply} />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <aside className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0 fade-up" style={{ animationDelay: '0.2s' }}>
                                <div className="bg-white rounded-2xl border border-[#E8DFC9] p-5">
                                    <h3 className="font-display font-semibold text-[#1B3A2B] text-base mb-4">About this thread</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[#8A9B8E]">Posted by</span>
                                            <span className="text-xs font-medium text-[#1B3A2B]">{thread.author ?? 'Anonymous'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[#8A9B8E]">Score</span>
                                            <span className="font-mono text-xs font-medium text-[#1B3A2B]">{thread.upvotes_score}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[#8A9B8E]">Comments</span>
                                            <span className="font-mono text-xs font-medium text-[#1B3A2B]">{totalComments}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[#8A9B8E]">Posted</span>
                                            <span className="font-mono text-xs text-[#8A9B8E]">{timeAgo(thread.created_at)}</span>
                                        </div>
                                    </div>
                                    {thread.protocol && (
                                        <div className="mt-4 pt-4 border-t border-[#E8DFC9]">
                                            <Link href={`/protocols/${thread.protocol.id}`}
                                                className="flex items-center gap-2 text-sm text-[#3F6B4F] hover:text-[#1B3A2B] transition-colors font-medium">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                    <path d="M12 5v14M12 5l-4 4M12 5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                View Protocol
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-[#1B3A2B]/4 rounded-2xl border border-[#E8DFC9] p-5">
                                    <h3 className="font-display font-semibold text-[#1B3A2B] text-sm mb-3">Community guidelines</h3>
                                    <ul className="space-y-2">
                                        {[
                                            'Share personal experience, not prescriptions',
                                            'Be kind — we are all learning',
                                            'Cite sources when quoting studies',
                                            'Upvote what helps the community',
                                        ].map(g => (
                                            <li key={g} className="flex items-start gap-2 text-xs text-[#2E4D3A]">
                                                <span className="text-[#3F6B4F] mt-0.5">✦</span>
                                                {g}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}