# NoteFlow

NoteFlow is a Notion-inspired, AI-powered writing assistant with a block editor, inline AI suggestions, semantic document search, and real-time collaboration.

## Stack

- Frontend: React 18, TypeScript, TipTap, TailwindCSS, Axios, WebSocket
- Backend: FastAPI, SQLAlchemy, PostgreSQL, pgvector, OpenAI, JWT auth
- Infra: Docker Compose, Nginx reverse proxy

## Quick Start

1. Copy `.env.example` to `.env` and add an OpenAI API key.
2. Run:

```bash
docker compose up --build
```

3. Open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- Reverse proxy: http://localhost

## Features

- TipTap block editor with paragraph, headings, lists, code blocks, quotes, and dividers
- Slash command menu
- Inline AI command popup with streaming suggestions and Tab/Escape controls
- Document sidebar with recent docs and creation flow
- Semantic search across document chunks with highlighted snippets
- WebSocket collaboration room per document with user cursors and block sync
- JWT auth with user profile colors
- Auto-save and auto-indexing on document save

