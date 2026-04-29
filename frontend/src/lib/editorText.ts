export function docToPlainText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  const children = Array.isArray(node.content) ? node.content : [];
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

