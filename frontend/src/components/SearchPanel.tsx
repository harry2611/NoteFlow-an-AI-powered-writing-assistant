import { ArrowRight, Search } from 'lucide-react';
import type { SearchResult } from '../types';
import { makeSnippet } from '../lib/editorText';

type Props = {
  query: string;
  results: SearchResult[];
  loading: boolean;
  onOpen: (documentId: string, chunkIndex: number) => void;
};

export function SearchPanel({ query, results, loading, onOpen }: Props) {
  if (!query.trim()) return null;

  return (
    <div className="search-panel">
      <div className="search-panel-heading">
        <Search size={16} />
        <span>{loading ? 'Searching...' : 'Semantic matches'}</span>
      </div>
      {results.map((result) => (
        <button
          className="search-result"
          key={`${result.document_id}-${result.chunk_index}`}
          type="button"
          onClick={() => onOpen(result.document_id, result.chunk_index)}
        >
          <strong>{result.document_title}</strong>
          <span>{makeSnippet(result.chunk_text, query)}</span>
          <small>
            Jump to section <ArrowRight size={13} />
          </small>
        </button>
      ))}
      {!loading && results.length === 0 && <p className="empty-state">No matching document sections yet.</p>}
    </div>
  );
}

