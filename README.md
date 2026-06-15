# Protocol Hub — Frontend

Next.js + Tailwind CSS frontend for **Protocol Hub**, a community-powered platform for sharing structured wellness protocols, discussing them in threads, leaving reviews, and voting on threads/comments.

The backend (Laravel API + Typesense search) lives in a separate repository:

**[protocol-hub-backend](https://github.com/biancadechosa/protocol-hub-backend)** — see that repo's README for API setup, Typesense configuration, and seeding instructions.

---

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```

   This should point to your running Laravel API (see the backend repo for setup).

3. Run the dev server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:3000`.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Browse and search protocols (Typesense), filter by tag, sort by recent/reviews/rating/upvotes, create a new protocol |
| `/protocols/[id]` | Protocol detail — content, embedded thread feed with voting, reviews sidebar with submission form, start a new thread |
| `/threads` | Global searchable/sortable thread feed across all protocols |
| `/threads/[id]` | Thread detail — voting, nested comments with replies at any depth, comment/reply forms |

---

## Voting UX

Vote controls use leaf icons (up = sage green, down = terracotta) instead of plain arrows. After every vote, the frontend refetches the affected thread/comment so the displayed score always reflects the live backend value (avoiding drift between cached search results and the database). Which arrow appears "active" is derived from the vote records returned by the API for the current browser's identifier, which is generated and persisted in `localStorage` (there is no authentication system).

---

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Framer Motion (animations)

## Known Limitations

- No authentication — votes and authorship are tied to a per-browser identifier (`localStorage`) or a freeform name field, not user accounts.
- Edit/delete UI is intentionally not implemented on the frontend, since without authentication there's no way to restrict destructive actions to a content's original author. The backend exposes full CRUD; update/delete endpoints can be exercised directly via the API.