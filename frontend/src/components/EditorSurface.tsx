import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Code2,
  Download,
  Focus,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Save,
  Sparkles
} from 'lucide-react';
import { AI_ACTIONS, type AIAction, AIPopup } from './AIPopup';
import { CollaborationPresence } from './CollaborationPresence';
import { streamSuggestion } from '../lib/api';
import { docToMarkdown, docToPlainText } from '../lib/editorText';
import { BlockId, ensureBlockIds } from '../editor/blockId';
import { SlashCommand } from '../editor/slashCommand';
import { useCollaboration } from '../hooks/useCollaboration';
import type { BlockUpdatePayload, Collaborator, NoteDocument } from '../types';

const lowlight = createLowlight(common);

type EditorStats = {
  words: number;
  blocks: number;
  characters: number;
  readingMinutes: number;
};

type Props = {
  token: string;
  document: NoteDocument | null;
  onSave: (title: string, content: Record<string, unknown>) => Promise<void>;
};

export function EditorSurface({ token, document, onSave }: Props) {
  const [title, setTitle] = useState(document?.title ?? 'Untitled');
  const [status, setStatus] = useState('Saved');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [lastInstruction, setLastInstruction] = useState('');
  const [remoteCursors, setRemoteCursors] = useState<Collaborator[]>([]);
  const [stats, setStats] = useState<EditorStats>({ words: 0, blocks: 0, characters: 0, readingMinutes: 1 });
  const [focusMode, setFocusMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const skipNextUpdate = useRef(false);
  const titleRef = useRef(title);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const saveDebounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const handleRemoteUpdate = useCallback((payload: BlockUpdatePayload) => {
    if (!editorRef.current || payload.content_json === editorRef.current.getJSON()) return;
    skipNextUpdate.current = true;
    editorRef.current.commands.setContent(payload.content_json);
    setTitle(payload.title);
    setStatus('Synced from collaborator');
  }, []);

  const { users, connected, sendUpdate, sendCursor } = useCollaboration(document?.id ?? null, token, handleRemoteUpdate);

  useEffect(() => {
    setRemoteCursors(users);
  }, [users]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: {
          HTMLAttributes: { class: 'noteflow-divider' }
        }
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Typography,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading';
          return 'Start writing...';
        }
      }),
      BlockId,
      SlashCommand
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: document?.content_json ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'prose-editor'
      },
      handleDOMEvents: {
        dragstart: (_, event) => {
          const dragEvent = event as DragEvent;
          const target = event.target as HTMLElement;
          const block = target.closest('[data-block-id]');
          if (block instanceof HTMLElement) {
            dragEvent.dataTransfer?.setData('text/noteflow-block-id', block.dataset.blockId ?? '');
          }
          return false;
        },
        drop: (view, event) => {
          const dragEvent = event as DragEvent;
          const blockId = dragEvent.dataTransfer?.getData('text/noteflow-block-id');
          if (!blockId) return false;
          const coords = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY });
          const source = findBlockPositionById(blockId);
          if (!coords || !source || source.pos === coords.pos) return false;
          const tr = view.state.tr.delete(source.pos, source.pos + source.node.nodeSize);
          const target = coords.pos > source.pos ? coords.pos - source.node.nodeSize : coords.pos;
          tr.insert(target, source.node);
          view.dispatch(tr);
          event.preventDefault();
          return true;
        }
      }
    },
    onCreate: ({ editor }) => ensureBlockIds(editor),
    onUpdate: ({ editor }) => {
      if (ensureBlockIds(editor)) return;
      setStats(calculateStats(editor.getJSON()));
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
      setStatus('Unsaved changes');
      sendUpdate({ type: 'block_update', title: titleRef.current, content_json: editor.getJSON() as Record<string, unknown> });
    },
    onSelectionUpdate: ({ editor }) => {
      const block = findCurrentBlock(editor.state.selection.from);
      sendCursor(block?.node.attrs.blockId, editor.state.selection.from);
      setStats(calculateStats(editor.getJSON()));
    }
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || !document) return;
    skipNextUpdate.current = true;
    editor.commands.setContent(document.content_json || { type: 'doc', content: [{ type: 'paragraph' }] });
    setTitle(document.title || 'Untitled');
    setStatus('Saved');
    setStats(calculateStats(document.content_json));
    window.setTimeout(() => ensureBlockIds(editor), 0);
  }, [document, editor]);

  // 30-second fallback auto-save (uses titleRef so no stale closure)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (editor && document) {
        void saveNow();
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [editor, document]);

  // Debounced save — triggers 2 s after the last "Unsaved changes" status
  useEffect(() => {
    if (status !== 'Unsaved changes') return;
    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = window.setTimeout(() => {
      if (editor && document) void saveNow();
    }, 2000);
    return () => {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    };
  }, [status, editor, document]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        showAiPanel();
      }
      if (event.key === 'Escape' && aiOpen) {
        event.preventDefault();
        setAiOpen(false);
        setAiSuggestion('');
      }
      if (event.key === 'Tab' && aiOpen && aiSuggestion) {
        event.preventDefault();
        acceptSuggestion();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aiOpen, aiSuggestion, editor, selectedOption, lastInstruction]);

  async function saveNow() {
    if (!editor || !document) return;
    setStatus('Saving...');
    try {
      await onSave(titleRef.current, editor.getJSON() as Record<string, unknown>);
      setStatus('Saved');
    } catch {
      setStatus('Save failed — will retry');
      window.setTimeout(() => setStatus('Unsaved changes'), 3000);
    }
  }

  function showAiPanel() {
    if (!editor || !document) return;
    setAiOpen(true);
    setAiError('');
    const selectedText = getSelectedText();
    if (!selectedText && !customPrompt) {
      setSelectedOption('');
    }
  }

  async function openAi(action: AIAction | string) {
    if (!editor || !document) return;
    const instruction = typeof action === 'string' ? action : action.instruction;
    const label = typeof action === 'string' ? action : action.label;
    setSelectedOption(label);
    setLastInstruction(instruction);
    setAiOpen(true);
    setAiLoading(true);
    setAiSuggestion('');
    setAiError('');
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const surroundingText = docToPlainText(editor.getJSON());
    let receivedChunks = 0;
    let fullResponse = '';
    try {
      await streamSuggestion(
        token,
        { text: selectedText, instruction, document_title: title, surrounding_text: surroundingText.slice(0, 4000) },
        (chunk) => {
          receivedChunks++;
          fullResponse += chunk;
          setAiSuggestion((value) => value + chunk);
        }
      );
      if (receivedChunks === 0) {
        setAiError('No response from AI — check backend deploy logs for details.');
      } else if (fullResponse.startsWith('[AI_ERROR:')) {
        const msg = fullResponse.replace(/^\[AI_ERROR:\s*/, '').replace(/\]$/, '');
        setAiSuggestion('');
        setAiError(`OpenAI error: ${msg}`);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI could not generate a suggestion.');
    } finally {
      setAiLoading(false);
    }
  }

  function runCustomPrompt() {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    void openAi({ label: 'Custom ask', instruction: prompt, description: 'Your prompt', tone: 'write' });
  }

  function regenerateSuggestion() {
    if (!lastInstruction) {
      const selectedText = getSelectedText();
      const fallbackAction = selectedText ? AI_ACTIONS[0] : AI_ACTIONS[1];
      void openAi(fallbackAction);
      return;
    }
    void openAi({ label: selectedOption || 'Regenerate', instruction: `${lastInstruction}\n\nTry a fresh version with different wording.`, description: 'Fresh version', tone: 'edit' });
  }

  function acceptSuggestion() {
    if (!editor || !aiSuggestion) return;
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, aiSuggestion).run();
    setAiOpen(false);
    setAiSuggestion('');
  }

  function insertSuggestionBelow() {
    if (!editor || !aiSuggestion) return;
    editor.chain().focus().insertContent([{ type: 'paragraph', content: [{ type: 'text', text: aiSuggestion }] }]).run();
    setAiOpen(false);
    setAiSuggestion('');
  }

  function getSelectedText() {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ').trim();
  }

  function getAiContextLabel() {
    const selectedWords = getSelectedText().split(/\s+/).filter(Boolean).length;
    if (selectedWords > 0) return `${selectedWords} selected words`;
    if (stats.words > 0) return `Using ${stats.words} document words`;
    return 'Ready for a new draft';
  }

  function safeFileName() {
    return (title || 'Untitled').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'noteflow-document';
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportMd() {
    if (!editor) return;
    downloadBlob(docToMarkdown(editor.getJSON()), `${safeFileName()}.md`, 'text/markdown;charset=utf-8');
    setExportOpen(false);
  }

  function exportTxt() {
    if (!editor) return;
    downloadBlob(docToPlainText(editor.getJSON()), `${safeFileName()}.txt`, 'text/plain;charset=utf-8');
    setExportOpen(false);
  }

  function exportPdf() {
    if (!editor) return;
    const docTitle = title || 'Untitled';
    const html = editor.getHTML();
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${docTitle}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 48px auto; line-height: 1.75; font-size: 16px; color: #1a1a1a; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 12px; margin-bottom: 28px; }
    h2 { font-size: 1.5em; margin-top: 36px; }
    h3 { font-size: 1.2em; margin-top: 28px; }
    p { margin: 14px 0; }
    ul, ol { padding-left: 28px; }
    li { margin: 6px 0; }
    blockquote { border-left: 3px solid #ccc; margin: 20px 0; padding: 8px 20px; color: #555; font-style: italic; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 0.88em; }
    pre { background: #f5f5f5; padding: 18px; border-radius: 6px; overflow-x: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
    @page { margin: 2cm; }
  </style>
</head>
<body>
  <h1>${docTitle}</h1>
  ${html}
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
    setExportOpen(false);
  }

  function calculateStats(content: Record<string, unknown>): EditorStats {
    const text = docToPlainText(content).trim();
    const words = text ? text.split(/\s+/).length : 0;
    const contentArray = content.content;
    const blocks = Array.isArray(contentArray) ? contentArray.length : 0;
    return {
      words,
      blocks,
      characters: text.length,
      readingMinutes: Math.max(1, Math.ceil(words / 220))
    };
  }

  function findBlockPositionById(blockId: string): { pos: number; node: ProseMirrorNode } | null {
    if (!editor) return null;
    let match: { pos: number; node: ProseMirrorNode } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.blockId === blockId) {
        match = { pos, node };
        return false;
      }
      return true;
    });
    return match;
  }

  function findCurrentBlock(position: number): { pos: number; node: ProseMirrorNode } | null {
    if (!editor) return null;
    let match: { pos: number; node: ProseMirrorNode } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (pos <= position && position <= pos + node.nodeSize && node.attrs.blockId) {
        match = { pos, node };
      }
      return true;
    });
    return match;
  }

  if (!document) {
    return (
      <section className="editor-empty">
        <h1>No document selected</h1>
        <p>Create or open a document to start writing.</p>
      </section>
    );
  }

  return (
    <section className={focusMode ? 'editor-shell focus-mode' : 'editor-shell'}>
      <header className="editor-toolbar">
        <div className="editor-title-zone">
          <input
            className="title-input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setStatus('Unsaved changes');
            }}
            onBlur={() => void saveNow()}
          />
          <div className="doc-metrics">
            <span>{stats.words} words</span>
            <span>{stats.characters.toLocaleString()} chars</span>
            <span>{stats.blocks} blocks</span>
            <span>{stats.readingMinutes} min read</span>
          </div>
        </div>
        <div className="toolbar-cluster">
          <div className="format-toolbar" aria-label="Formatting">
            <button className={editor?.isActive('bold') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
              <Bold size={16} />
            </button>
            <button className={editor?.isActive('italic') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
              <Italic size={16} />
            </button>
            <button className={editor?.isActive('heading', { level: 1 }) ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
              <Heading1 size={16} />
            </button>
            <button className={editor?.isActive('heading', { level: 2 }) ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
              <Heading2 size={16} />
            </button>
            <button className={editor?.isActive('heading', { level: 3 }) ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
              <Heading3 size={16} />
            </button>
            <button className={editor?.isActive('bulletList') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
              <List size={16} />
            </button>
            <button className={editor?.isActive('orderedList') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
              <ListOrdered size={16} />
            </button>
            <button className={editor?.isActive('blockquote') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Quote">
              <Quote size={16} />
            </button>
            <button className={editor?.isActive('codeBlock') ? 'tool-button active' : 'tool-button'} type="button" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} title="Code block">
              <Code2 size={16} />
            </button>
          </div>
          <div className="toolbar-actions">
            <CollaborationPresence users={remoteCursors} connected={connected} />
            <span className="save-status">{status}</span>
            <button className="icon-button ai-quick" type="button" onClick={showAiPanel} title="AI Copilot (Ctrl+J / ⌘J)">
              <Sparkles size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => setExportOpen(true)} title="Export document">
              <Download size={18} />
            </button>
            <button className={focusMode ? 'icon-button active' : 'icon-button'} type="button" onClick={() => setFocusMode((value) => !value)} title="Focus mode">
              <Focus size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => void saveNow()} title="Save">
              <Save size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="editor-canvas">
        <div className="drag-hint" title="Drag blocks by their edge">
          <GripVertical size={18} />
        </div>
        <EditorContent editor={editor} />
        <AIPopup
          open={aiOpen}
          loading={aiLoading}
          suggestion={aiSuggestion}
          selectedOption={selectedOption}
          customPrompt={customPrompt}
          contextLabel={getAiContextLabel()}
          error={aiError}
          onOption={(action) => void openAi(action)}
          onCustomPromptChange={setCustomPrompt}
          onCustomSubmit={runCustomPrompt}
          onAccept={acceptSuggestion}
          onInsertBelow={insertSuggestionBelow}
          onRegenerate={regenerateSuggestion}
          onDismiss={() => {
            setAiOpen(false);
            setAiSuggestion('');
            setAiError('');
          }}
        />
      </div>

      {exportOpen && (
        <div className="export-overlay" onClick={() => setExportOpen(false)}>
          <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="export-title">Export document</h3>
            <p className="export-subtitle">Choose a format to download</p>
            <div className="export-options">
              <button className="export-option" type="button" onClick={exportMd}>
                <span className="export-icon">📝</span>
                <span className="export-label">Markdown</span>
                <span className="export-ext">.md</span>
              </button>
              <button className="export-option" type="button" onClick={exportTxt}>
                <span className="export-icon">📄</span>
                <span className="export-label">Plain text</span>
                <span className="export-ext">.txt</span>
              </button>
              <button className="export-option" type="button" onClick={exportPdf}>
                <span className="export-icon">📑</span>
                <span className="export-label">PDF</span>
                <span className="export-ext">.pdf</span>
              </button>
            </div>
            <button className="export-cancel" type="button" onClick={() => setExportOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
