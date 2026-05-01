import { FormEvent, useState } from 'react';
import { Check, Clipboard, Lightbulb, PencilLine, RefreshCw, Send, Sparkles, Wand2, X } from 'lucide-react';

export type AIAction = {
  label: string;
  instruction: string;
  description: string;
  tone: 'write' | 'edit' | 'shape';
};

export const AI_ACTIONS: AIAction[] = [
  {
    label: 'Smart edit',
    instruction: 'Improve this writing with a natural voice, stronger flow, and clear wording.',
    description: 'Best all-purpose rewrite',
    tone: 'edit'
  },
  {
    label: 'Continue',
    instruction: 'Continue writing from this point with two polished sentences that match the document.',
    description: 'Keep the thought moving',
    tone: 'write'
  },
  {
    label: 'Rewrite warmer',
    instruction: 'Rewrite this in a warmer, more human tone while keeping the same meaning.',
    description: 'More approachable',
    tone: 'edit'
  },
  {
    label: 'Make concise',
    instruction: 'Make this shorter and sharper without losing important meaning.',
    description: 'Trim extra words',
    tone: 'shape'
  },
  {
    label: 'Make formal',
    instruction: 'Rewrite this in a polished, professional, formal style.',
    description: 'Professional tone',
    tone: 'edit'
  },
  {
    label: 'Summarize',
    instruction: 'Summarize the selected text or current section into a concise takeaway.',
    description: 'Extract key point',
    tone: 'shape'
  },
  {
    label: 'Fix grammar',
    instruction: 'Fix grammar, spelling, punctuation, and awkward phrasing only.',
    description: 'Clean up wording',
    tone: 'edit'
  },
  {
    label: 'Brainstorm',
    instruction: 'Suggest five useful ideas, angles, or next points for this document.',
    description: 'Generate directions',
    tone: 'write'
  }
];

type Props = {
  open: boolean;
  loading: boolean;
  suggestion: string;
  selectedOption: string;
  customPrompt: string;
  contextLabel: string;
  error: string;
  onOption: (action: AIAction) => void;
  onCustomPromptChange: (prompt: string) => void;
  onCustomSubmit: () => void;
  onAccept: () => void;
  onInsertBelow: () => void;
  onRegenerate: () => void;
  onDismiss: () => void;
};

export function AIPopup({
  open,
  loading,
  suggestion,
  selectedOption,
  customPrompt,
  contextLabel,
  error,
  onOption,
  onCustomPromptChange,
  onCustomSubmit,
  onAccept,
  onInsertBelow,
  onRegenerate,
  onDismiss
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function submitPrompt(event: FormEvent) {
    event.preventDefault();
    onCustomSubmit();
  }

  function copyToClipboard() {
    if (!suggestion) return;
    void navigator.clipboard.writeText(suggestion);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="ai-popup">
      <div className="ai-popup-title">
        <span className="ai-orb">
          <Wand2 size={17} />
        </span>
        <span>
          <strong>NoteFlow AI</strong>
          <small>{contextLabel}</small>
        </span>
        <button className="ai-close" type="button" onClick={onDismiss} title="Close AI">
          <X size={16} />
        </button>
      </div>

      <form className="ai-prompt-box" onSubmit={submitPrompt}>
        <PencilLine size={16} />
        <input
          value={customPrompt}
          onChange={(event) => onCustomPromptChange(event.target.value)}
          placeholder="Ask AI anything about this draft..."
        />
        <button disabled={loading || !customPrompt.trim()} type="submit" title="Run custom prompt">
          <Send size={15} />
        </button>
      </form>

      <div className="ai-options">
        {AI_ACTIONS.map((action) => (
          <button
            className={action.label === selectedOption ? `ai-option active ${action.tone}` : `ai-option ${action.tone}`}
            key={action.label}
            type="button"
            onClick={() => onOption(action)}
          >
            <span>{action.label}</span>
            <small>{action.description}</small>
          </button>
        ))}
      </div>

      <div className={loading ? 'ai-suggestion thinking' : 'ai-suggestion'}>
        {error && <span className="ai-error">{error}</span>}
        {!error && loading && !suggestion && (
          <span className="ai-thinking">
            <Sparkles size={16} />
            Thinking through the surrounding context...
          </span>
        )}
        {!error && !loading && !suggestion && (
          <span className="ai-empty">
            <Lightbulb size={16} />
            Pick a smart action or write your own prompt.
          </span>
        )}
        {!error && suggestion}
      </div>

      <div className="ai-actions">
        <button type="button" onClick={onRegenerate} disabled={loading || !selectedOption}>
          <RefreshCw size={15} />
          Regenerate
        </button>
        <button type="button" className={copied ? 'copied' : ''} onClick={copyToClipboard} disabled={!suggestion || loading}>
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" onClick={onInsertBelow} disabled={!suggestion || loading}>
          Insert below
        </button>
        <button type="button" onClick={onAccept} disabled={!suggestion || loading}>
          <Check size={15} />
          Replace
        </button>
      </div>
    </div>
  );
}
