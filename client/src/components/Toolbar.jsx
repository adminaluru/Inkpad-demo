function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`tool${active ? ' active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the selection in the editor when the button is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function currentBlock(editor) {
  for (const level of [1, 2, 3]) {
    if (editor.isActive('heading', { level })) return String(level);
  }
  return 'p';
}

export default function Toolbar({ editor }) {
  if (!editor) return null;

  const chain = () => editor.chain().focus();

  function setBlock(value) {
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value) }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <select
        value={currentBlock(editor)}
        onChange={(event) => setBlock(event.target.value)}
        aria-label="Text style"
      >
        <option value="p">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <span className="divider" />

      <ToolButton label="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
        <strong>B</strong>
      </ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
        <em>I</em>
      </ToolButton>
      <ToolButton label="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </ToolButton>

      <span className="divider" />

      <ToolButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
        • List
      </ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>
        1. List
      </ToolButton>

      <span className="divider" />

      <ToolButton label="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
        Undo
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
        Redo
      </ToolButton>
    </div>
  );
}
