const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchProtocols(params?: {
    search?: string;
    sort?: string;
    per_page?: number;
    page?: number;
}) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.page) query.set('page', String(params.page));

    const res = await fetch(`${BASE_URL}/search/protocols?${query}`);
    if (!res.ok) throw new Error('Failed to fetch protocols');
    return res.json();
}

export async function fetchProtocol(id: number) {
    const res = await fetch(`${BASE_URL}/protocols/${id}`);
    if (!res.ok) throw new Error('Failed to fetch protocol');
    return res.json();
}

export async function createProtocol(data: {
    title: string;
    content: string;
    tags: string[];
    author: string;
}) {
    const res = await fetch(`${BASE_URL}/protocols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create protocol');
    return res.json();
}

export async function fetchThreads(params?: {
    search?: string;
    sort?: string;
    protocol_id?: number;
    per_page?: number;
    page?: number;
}) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.protocol_id) query.set('protocol_id', String(params.protocol_id));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.page) query.set('page', String(params.page));

    const res = await fetch(`${BASE_URL}/search/threads?${query}`);
    if (!res.ok) throw new Error('Failed to fetch threads');
    return res.json();
}

export async function fetchThread(id: number) {
    const res = await fetch(`${BASE_URL}/threads/${id}`);
    if (!res.ok) throw new Error('Failed to fetch thread');
    return res.json();
}

export async function fetchComments(threadId: number) {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/comments`);
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
}

export async function fetchReviews(protocolId: number) {
    const res = await fetch(`${BASE_URL}/protocols/${protocolId}/reviews`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
}

export async function createThread(protocolId: number, data: {
    title: string;
    body: string;
    author: string;
}) {
    const res = await fetch(`${BASE_URL}/protocols/${protocolId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create thread');
    return res.json();
}

export async function createComment(threadId: number, data: {
    content: string;
    author: string;
}) {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create comment');
    return res.json();
}

export async function createReply(commentId: number, data: {
    content: string;
    author: string;
}) {
    const res = await fetch(`${BASE_URL}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create reply');
    return res.json();
}

export async function createReview(protocolId: number, data: {
    rating: number;
    feedback?: string;
    author: string;
}) {
    const res = await fetch(`${BASE_URL}/protocols/${protocolId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create review');
    return res.json();
}

export async function castVote(data: {
    votable_type: 'thread' | 'comment';
    votable_id: number;
    value: 1 | -1;
    user_identifier: string;
}) {
    const res = await fetch(`${BASE_URL}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to cast vote');
    return res.json();
}

export async function fetchThreadById(id: number) {
    const res = await fetch(`${BASE_URL}/threads/${id}`);
    if (!res.ok) throw new Error('Failed to fetch thread');
    return res.json();
}

