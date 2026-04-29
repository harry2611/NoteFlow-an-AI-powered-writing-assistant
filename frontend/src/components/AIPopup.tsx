import { Wand2 } from 'lucide-react';

export const AI_OPTIONS = [
  'Continue writing',
  'Improve this paragraph',
  'Make it shorter',
  'Make it more formal',
  'Summarize selection',
  'Fix grammar'
] as const;

type Props = {
  open: boolean;
  loading: boolean;
  suggestion: string;
  selectedOption: string;
  onOption: (option: string) => void;
  onAccept: () => void;
  onDismiss: () => void;
};

export function AIPopup({ open, loading, suggestion, selectedOption, onOption, onAccept, onDismiss }: Props) {
  if (!open) return null;

  return (
    <div className="ai-popup">
      <div className="ai-popup-title">
        <Wand2 size={16} />
        <span>AI writing</span>
      </div>
      <div className="ai-options">
        {AI_OPTIONS.map((option) => (
          <button
            className={option === selectedOption ? 'ai-option active' : 'ai-option'}
            key={option}
            type="button"
            onClick={() => onOption(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="ai-suggestion">
        {loading && !suggestion ? 'Thinking...' : suggestion || 'Choose an action to stream a suggestion.'}
      </div>
      {suggestion && (
        <div className="ai-actions">
          <button type="button" onClick={onDismiss}>Dismiss</button>
          <button type="button" onClick={onAccept}>Accept</button>
        </div>
      )}
    </div>
  );
}

