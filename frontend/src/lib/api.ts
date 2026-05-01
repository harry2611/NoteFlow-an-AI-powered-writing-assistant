import axios from 'axios';
import type { AuthResponse, DocumentListItem, NoteDocument, SearchResult } from '../types';

function sameOriginApiUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  return `${window.location.origin}/api`;
}

function sameOriginWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:8000';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export const API_URL = import.meta.env.VITE_API_URL || sameOriginApiUrl();
export const WS_URL = import.meta.env.VITE_WS_URL || sameOriginWsUrl();

export const api = axios.create({
  baseURL: API_URL
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function listDocuments() {
  const { data } = await api.get<DocumentListItem[]>('/documents');
  return data;
}

export async function createDocument() {
  const { data } = await api.post<NoteDocument>('/documents', {
    title: 'Untitled',
    content_json: {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { blockId: crypto.randomUUID() } }]
    }
  });
  return data;
}

export async function getDocument(id: string) {
  const { data } = await api.get<NoteDocument>(`/documents/${id}`);
  return data;
}

export async function saveDocument(id: string, title: string, content_json: Record<string, unknown>) {
  const { data } = await api.put<NoteDocument>(`/documents/${id}`, { title, content_json });
  return data;
}

export async function deleteDocument(id: string) {
  await api.delete(`/documents/${id}`);
}

export async function semanticSearch(query: string) {
  const { data } = await api.post<SearchResult[]>('/search/query', { query, limit: 5 });
  return data;
}

export async function streamSuggestion(
  token: string,
  payload: { text: string; instruction: string; document_title?: string; surrounding_text?: string },
  onToken: (token: string) => void
) {
  const response = await fetch(`${API_URL}/ai/suggest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) {
    throw new Error('Unable to stream AI suggestion');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onToken(decoder.decode(value, { stream: true }));
  }
}
