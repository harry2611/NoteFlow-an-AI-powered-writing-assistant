import { FileText, LogOut, Moon, Plus, Search, Sparkles, Sun, Trash2 } from 'lucide-react';
import type { DocumentListItem, UserProfile } from '../types';

type Props = {
  documents: DocumentListItem[];
  activeId: string | null;
  query: string;
  darkMode: boolean;
  user: UserProfile;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onToggleDarkMode: () => void;
};

export function Sidebar({
  documents,
  activeId,
  query,
  darkMode,
  user,
  onQueryChange,
  onCreate,
  onOpen,
  onDelete,
  onLogout,
  onToggleDarkMode
}: Props) {
  const recent = documents.slice(0, 5);
  const updatedToday = documents.filter((document) => {
    const updated = new Date(document.updated_at);
    const today = new Date();
    return updated.toDateString() === today.toDateString();
  }).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-mark small">
          <FileText size={18} />
          <span>NoteFlow</span>
        </div>
        <button className="icon-button" type="button" onClick={onToggleDarkMode} title="Toggle dark mode">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="profile-card">
        <span className="profile-avatar" style={{ backgroundColor: user.avatar_color }}>
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="profile-copy">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <button className="icon-button" type="button" onClick={onLogout} title="Log out">
          <LogOut size={17} />
        </button>
      </div>

      <button className="new-doc-button" type="button" onClick={onCreate}>
        <Plus size={16} />
        <span>New document</span>
      </button>

      <label className="sidebar-search">
        <Search size={16} />
        <input
          placeholder="Search your docs"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <section className="workspace-stats" aria-label="Workspace stats">
        <span>
          <strong>{documents.length}</strong>
          <small>Docs</small>
        </span>
        <span>
          <strong>{updatedToday}</strong>
          <small>Updated</small>
        </span>
        <span>
          <Sparkles size={15} />
          <small>AI ready</small>
        </span>
      </section>

      <section className="sidebar-section">
        <h2>Recent</h2>
        {recent.map((document) => (
          <button
            className={document.id === activeId ? 'doc-row active' : 'doc-row'}
            key={document.id}
            type="button"
            onClick={() => onOpen(document.id)}
          >
            <FileText size={15} />
            <span>{document.title || 'Untitled'}</span>
          </button>
        ))}
      </section>

      <section className="sidebar-section scrollable">
        <h2>All documents</h2>
        {documents.map((document) => (
          <div className={document.id === activeId ? 'doc-row-shell active' : 'doc-row-shell'} key={document.id}>
            <button className="doc-row" type="button" onClick={() => onOpen(document.id)}>
              <span className="doc-dot" />
              <span>{document.title || 'Untitled'}</span>
            </button>
            <button
              className="doc-action"
              type="button"
              onClick={() => onDelete(document.id)}
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
