type TipTapMark = { type: string };

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
};

export function docToPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as TipTapNode;
  if (typeof n.text === 'string') return n.text;
  const children = Array.isArray(n.content) ? n.content : [];
  return children.map(docToPlainText).filter(Boolean).join(' ');
}

export function makeSnippet(text: string, query: string) {
  const normalized = text.trim();
  const term = query.trim().split(/\s+/)[0]?.toLowerCase();
  if (!term) return normalized.slice(0, 220);
  const index = normalized.toLowerCase().indexOf(term);
  if (index < 0) return normalized.slice(0, 220);
  const start = Math.max(0, index - 80);
  return normalized.slice(start, start + 220);
}

// ---------------------------------------------------------------------------
// Markdown serializer
// ---------------------------------------------------------------------------

function inlinesToMarkdown(nodes: TipTapNode[]): string {
  return nodes
    .map((node) => {
      if (node.type !== 'text' || typeof node.text !== 'string') return '';
      let t = node.text;
      const marks = node.marks ?? [];
      const hasCode = marks.some((m) => m.type === 'code');
      const hasBold = marks.some((m) => m.type === 'bold');
      const hasItalic = marks.some((m) => m.type === 'italic');
      const hasStrike = marks.some((m) => m.type === 'strike');
      if (hasCode) return `\`${t}\``;
      if (hasBold && hasItalic) return `***${t}***`;
      if (hasBold) return `**${t}**`;
      if (hasItalic) return `_${t}_`;
      if (hasStrike) return `~~${t}~~`;
      return t;
    })
    .join('');
}

function blockToMarkdown(block: TipTapNode, listIndex?: number): string {
  const children = block.content ?? [];
  switch (block.type) {
    case 'heading': {
      const level = typeof block.attrs?.level === 'number' ? block.attrs.level : 1;
      return `${'#'.repeat(level)} ${inlinesToMarkdown(children)}`;
    }
    case 'paragraph':
      return inlinesToMarkdown(children);
    case 'bulletList':
      return children
        .filter((item) => item.type === 'listItem')
        .map((item) => {
          const inner = (item.content ?? []).map((b) => blockToMarkdown(b)).join('\n');
          return `- ${inner}`;
        })
        .join('\n');
    case 'orderedList':
      return children
        .filter((item) => item.type === 'listItem')
        .map((item, idx) => {
          const inner = (item.content ?? []).map((b) => blockToMarkdown(b)).join('\n');
          return `${(listIndex ?? 0) + idx + 1}. ${inner}`;
        })
        .join('\n');
    case 'listItem':
      return children.map((b) => blockToMarkdown(b)).join('\n');
    case 'blockquote':
      return children
        .map((b) => blockToMarkdown(b))
        .join('\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'codeBlock': {
      const lang = typeof block.attrs?.language === 'string' ? block.attrs.language : '';
      const code = inlinesToMarkdown(children);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    default:
      return inlinesToMarkdown(children);
  }
}

export function docToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const root = doc as TipTapNode;
  const blocks = root.content ?? [];
  return blocks.map((b) => blockToMarkdown(b)).join('\n\n');
}

