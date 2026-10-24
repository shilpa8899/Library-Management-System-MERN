# Features added to the existing library project

The project has been updated with:

- Semantic search from natural-language queries.
- Personalized, popular, recently added, and similar-book recommendations.
- In-app notifications and unread counts.
- Borrowing/return email confirmations and scheduled due-date/overdue notices.

## Backend setup

1. Open a terminal in `backend`.
2. Run `npm install` (not `npm ci`; the attached project's lockfile needs to be refreshed to include the new `node-cron` and `nodemailer` dependencies).
3. Copy `.env.example` to `.env` and set your existing `MONGO_URI` and `JWT_SECRET` values.
4. For semantic search, set `OPENAI_API_KEY`, `EMBEDDING_MODEL=text-embedding-3-small`, and `MONGODB_VECTOR_INDEX=book_embedding_index`.
5. In MongoDB Atlas, create a Vector Search index on the `books` collection. Name it `book_embedding_index` and use the index definition in `backend/config/bookVectorSearchIndex.json`.
6. Run `npm run index:embeddings` to create embeddings for existing books. New books and edits to searchable metadata are embedded automatically when the API key is configured.
7. Run `npm run dev`.

`text-embedding-3-small` produces 1536-dimensional vectors, so the index must use `numDimensions: 1536`. If you change models, verify the model's dimensions and rebuild the index and stored embeddings.

Semantic search requires MongoDB Atlas Vector Search and an embedding API key. Ordinary keyword search still works without these settings. An embedding API can incur usage charges according to the provider's current pricing.

## Frontend setup

1. Open another terminal in `backend/frontend`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` if your API base URL differs from the default.
4. Run `npm run dev` and open the local Vite URL shown in the terminal.

## Email setup

Email is optional. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `backend/.env`. For Gmail, use an app password where required; do not put your normal account password into source code. If SMTP settings are absent, the application still supports borrowing and in-app notifications but does not send email.

The due-date job runs at 8:00 AM in the server's local timezone. For deployment, ensure the hosting platform keeps the backend process running; serverless hosts that stop between requests need a separate scheduled job.

## Added endpoints

- `GET /api/books/semantic-search?q=...`
- `GET /api/books/recommendations/popular`
- `GET /api/books/recommendations/for-you` (authentication required)
- `GET /api/books/:id/similar`
- `GET /api/notifications` (authentication required)
- `PATCH /api/notifications/:id/read` (authentication required)
- `PATCH /api/notifications/read-all` (authentication required)
