import { useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { EditorSurface } from './components/EditorSurface';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { createDocument, deleteDocument, getDocument, listDocuments, saveDocument, semanticSearch, setAuthToken } from './lib/api';
import type { AuthResponse, DocumentListItem, NoteDocument, SearchResult, UserProfile } from './types';

const AUTH_KEY = 'noteflow-auth';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [activeDocument, setActiveDocument] = useState<NoteDocument | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const cached = window.localStorage.getItem(AUTH_KEY);
    if (!cached) return;
    const auth = JSON.parse(cached) as AuthResponse;
    handleAuthenticated(auth);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!token) return;
    void refreshDocuments();
  }, [token]);

  useEffect(() => {
    if (!token || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await semanticSearch(query));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  const filteredDocuments = useMemo(() => {
    if (!query.trim()) return documents;
    const lower = query.toLowerCase();
    return documents.filter((document) => document.title.toLowerCase().includes(lower));
  }, [documents, query]);

  function handleAuthenticated(auth: AuthResponse) {
    setToken(auth.access_token);
    setUser(auth.user);
    setAuthToken(auth.access_token);
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  }

  function logout() {
    setToken(null);
    setUser(null);
    setDocuments([]);
    setActiveDocument(null);
    setQuery('');
    setResults([]);
    setAuthToken(null);
    window.localStorage.removeItem(AUTH_KEY);
  }

  async function refreshDocuments() {
    const docs = await listDocuments();
    setDocuments(docs);
    if (!activeDocument && docs[0]) {
      await openDocument(docs[0].id);
    }
  }

  async function openDocument(id: string, chunkIndex?: number) {
    const doc = await getDocument(id);
    setActiveDocument(doc);
    setQuery('');
    if (typeof chunkIndex === 'number') {
      window.setTimeout(() => {
        document.querySelectorAll('[data-block-id]')[chunkIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  async function createNewDocument() {
    const doc = await createDocument();
    setActiveDocument(doc);
    await refreshDocuments();
  }

  async function removeDocument(id: string) {
    const documentToDelete = documents.find((document) => document.id === id);
    const confirmed = window.confirm(`Delete "${documentToDelete?.title || 'Untitled'}"?`);
    if (!confirmed) return;
    await deleteDocument(id);
    const nextDocuments = documents.filter((document) => document.id !== id);
    setDocuments(nextDocuments);
    if (activeDocument?.id === id) {
      setActiveDocument(null);
      if (nextDocuments[0]) {
        await openDocument(nextDocuments[0].id);
      }
    }
  }

  async function persistActiveDocument(title: string, content: Record<string, unknown>) {
    if (!activeDocument) return;
    const saved = await saveDocument(activeDocument.id, title, content);
    setActiveDocument(saved);
    await refreshDocuments();
  }

  if (!token || !user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        documents={filteredDocuments}
        activeId={activeDocument?.id ?? null}
        query={query}
        darkMode={darkMode}
        user={user}
        onQueryChange={setQuery}
        onCreate={createNewDocument}
        onOpen={openDocument}
        onDelete={removeDocument}
        onLogout={logout}
        onToggleDarkMode={() => setDarkMode((value) => !value)}
      />
      <main className="workspace">
        <SearchPanel query={query} results={results} loading={searching} onOpen={openDocument} />
        <EditorSurface token={token} document={activeDocument} onSave={persistActiveDocument} />
      </main>
    </div>
  );
}
