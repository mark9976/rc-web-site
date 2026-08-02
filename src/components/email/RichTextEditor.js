'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Heading2, Quote, Undo2, Redo2 } from 'lucide-react';

/**
 * TipTap wrapper. Chosen over react-quill because Quill touches the DOM during
 * module evaluation, which breaks under the App Router's server rendering.
 */
export default function RichTextEditor({ value, onChange, placeholder = 'Write your message...', minHeight = 220 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    // Required in the App Router: without it, TipTap renders on the server and
    // React reports a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: instance }) => onChange?.(instance.getHTML()),
  });

  // Keep the editor in step when the parent swaps content (template chosen,
  // reply pre-filled) without clobbering what the user is typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="rounded-2xl border border-black/10 bg-surface-card" style={{ minHeight }} />;
  }

  const Btn = ({ onClick, active, title, children }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-field-green/15 text-field-green' : 'text-ink-muted hover:bg-surface-muted'}`}
    >
      {children}
    </button>
  );

  const addLink = () => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('Link URL', previous || 'https://');
    if (url === null) return;
    if (url === '') return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 bg-surface-card px-2 py-1.5">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading"><Heading2 className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-black/10 mx-1" />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-black/10 mx-1" />
        <Btn onClick={addLink} active={editor.isActive('link')} title="Link"><Link2 className="w-4 h-4" /></Btn>
        <span className="ml-auto flex gap-1">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 className="w-4 h-4" /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 className="w-4 h-4" /></Btn>
        </span>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}
