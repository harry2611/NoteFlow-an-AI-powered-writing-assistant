import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { Code2, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Pilcrow, Quote } from 'lucide-react';
import { createRoot, type Root } from 'react-dom/client';

type SlashItem = {
  title: string;
  description: string;
  icon: typeof Pilcrow;
  command: (editor: Editor, range: { from: number; to: number }) => void;
};

const items: SlashItem[] = [
  {
    title: 'Paragraph',
    description: 'Plain text',
    icon: Pilcrow,
    command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run()
  },
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: Heading1,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
  },
  {
    title: 'Heading 2',
    description: 'Section heading',
    icon: Heading2,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: Heading3,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: List,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run()
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: ListOrdered,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run()
  },
  {
    title: 'Code Block',
    description: 'Code snippet',
    icon: Code2,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
  },
  {
    title: 'Quote',
    description: 'Quoted text',
    icon: Quote,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run()
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: Minus,
    command: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run()
  }
];

function SlashMenu({ selected, command }: { selected: number; command: (item: SlashItem) => void }) {
  return (
    <div className="slash-menu">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            className={index === selected ? 'slash-menu-item is-selected' : 'slash-menu-item'}
            key={item.title}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              command(item);
            }}
          >
            <span className="slash-menu-icon"><Icon size={16} /></span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    let root: Root | null = null;
    let element: HTMLDivElement | null = null;
    let selected = 0;
    let activeCommand: ((item: SlashItem) => void) | null = null;

    const render = (props: any) => {
      if (!element) {
        element = document.createElement('div');
        element.className = 'slash-menu-wrap';
        document.body.appendChild(element);
        root = createRoot(element);
      }
      activeCommand = (item) => props.command(item);
      const rect = props.clientRect?.();
      if (rect) {
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.bottom + 8}px`;
      }
      root?.render(<SlashMenu selected={selected} command={(item) => activeCommand?.(item)} />);
    };

    const destroy = () => {
      root?.unmount();
      root = null;
      element?.remove();
      element = null;
      selected = 0;
      activeCommand = null;
    };

    return [
      Suggestion({
        editor: this.editor as Editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 9),
        command: ({ editor, range, props }) => {
          (props as SlashItem).command(editor, range);
        },
        render: () => ({
          onStart: (props) => render(props),
          onUpdate: (props) => render(props),
          onKeyDown: ({ event }) => {
            if (event.key === 'ArrowDown') {
              selected = (selected + 1) % items.length;
              event.preventDefault();
              return true;
            }
            if (event.key === 'ArrowUp') {
              selected = (selected - 1 + items.length) % items.length;
              event.preventDefault();
              return true;
            }
            if (event.key === 'Enter') {
              activeCommand?.(items[selected]);
              event.preventDefault();
              return true;
            }
            return false;
          },
          onExit: destroy
        })
      })
    ];
  }
});
