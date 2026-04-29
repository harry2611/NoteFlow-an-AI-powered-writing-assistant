import { Extension, type Editor } from '@tiptap/core';

const BLOCK_TYPES = ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'codeBlock', 'blockquote', 'horizontalRule'];

export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return { 'data-block-id': attributes.blockId, draggable: 'true' };
            }
          }
        }
      }
    ];
  }
});

export function ensureBlockIds(editor: Editor) {
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (!BLOCK_TYPES.includes(node.type.name) || node.attrs.blockId) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: crypto.randomUUID() });
    changed = true;
  });
  if (changed) {
    editor.view.dispatch(tr);
  }
  return changed;
}
