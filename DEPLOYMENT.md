# Deploy NoteFlow to the Internet

The easiest hosted path for this app is Render:

- Render Web Service for the FastAPI backend
- Render Static Site for the React frontend
- Render Postgres for PostgreSQL + pgvector

This works better than Vercel for the full app because NoteFlow uses WebSockets for collaboration, and Render web services support WebSocket connections.

## 1. Push the Code to GitHub

The repository should be available on GitHub:

```text
https://github.com/harry2611/NoteFlow-an-AI-powered-writing-assistant
```

## 2. Create a Render Postgres Database

1. Go to Render.
2. Click **New > PostgreSQL**.
3. Create a database named `noteflow-db`.
4. After it is created, open the database shell or connect with the provided PSQL command.
5. Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Copy the database **Internal Database URL**. The backend will use it as `DATABASE_URL`.

## 3. Deploy the Backend

1. Click **New > Web Service**.
2. Connect the GitHub repo.
3. Use these settings:

```text
Name: noteflow-api
Runtime: Docker
Root Directory: backend
Dockerfile Path: ./Dockerfile.prod
Branch: main
```

4. Add environment variables:

```text
DATABASE_URL=<Render internal database URL>
JWT_SECRET=<a long random secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
OPENAI_API_KEY=<your OpenAI key>
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGIN=https://your-frontend-name.onrender.com
WEB_CONCURRENCY=2
```

5. Deploy.

Your backend URL will look like:

```text
https://noteflow-api.onrender.com
```

Check:

```text
https://noteflow-api.onrender.com/health
```

## 4. Deploy the Frontend

1. Click **New > Static Site**.
2. Connect the same GitHub repo.
3. Use these settings:

```text
Name: noteflow-web
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
Branch: main
```

4. Add environment variables:

```text
VITE_API_URL=https://noteflow-api.onrender.com
VITE_WS_URL=wss://noteflow-api.onrender.com
```

5. Deploy.

Your frontend URL will look like:

```text
https://noteflow-web.onrender.com
```

## 5. Update Backend CORS

After the frontend URL is created, go back to the backend service and set:

```text
FRONTEND_ORIGIN=https://noteflow-web.onrender.com
```

Redeploy the backend.

## 6. Optional Custom Domain

Add your custom domain in Render for the frontend static site. Then update backend `FRONTEND_ORIGIN` to that HTTPS domain.

## Alternative: Deploy on a VPS

If you have a VPS, use:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This runs frontend, backend, Postgres, and Nginx together on one server.
