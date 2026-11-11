import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AppHeader from '../components/AppHeader.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import Toolbar from '../components/Toolbar.jsx';
import { ROLE_LABELS } from '../format.js';
import { useAutosave } from '../hooks/useAutosave.js';

const UNTITLED = 'Untitled document';

const STATUS_TEXT = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes…',
  saving: 'Saving…',
};

function SaveStatus({ status, error, onRetry }) {
  if (status === 'error') {
    return (
      <span className="save-status error" role="alert">
        Couldn't save: {error}{' '}
        <button type="button" className="link" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  return <span className="save-status muted" aria-live="polite">{STATUS_TEXT[status]}</span>;
}

function DocumentEditor({ doc, onSharesChange }) {
  const canEdit = doc.role !== 'viewer';
  const [title, setTitle] = useState(doc.title);
  const [sharing, setSharing] = useState(false);

  const save = useCallback((changes) => api.updateDocument(doc.id, changes), [doc.id]);
  const { status, error, queue, flush } = useAutosave(save);

  const editor = useEditor({
    // Links are switched off because the server only stores the tags listed
    // in server/src/sanitize.js, and a link would silently vanish on save.
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
    ],
    content: doc.content,
    editable: canEdit,
    // The toolbar reads the active marks from the editor on every render.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => queue({ content: current.getHTML() }),
  });

  // Ctrl/Cmd+S saves right away instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

  useEffect(() => {
    document.title = `${title.trim() || UNTITLED} · Inkpad`;
    return () => { document.title = 'Inkpad'; };
  }, [title]);

  function handleTitleChange(event) {
    const next = event.target.value;
    setTitle(next);
    // An empty title is never sent; it gets a fallback when the field loses focus.
    if (next.trim()) queue({ title: next });
  }

  function handleTitleBlur() {
    if (!title.trim()) {
      setTitle(UNTITLED);
      queue({ title: UNTITLED });
    }
  }

  return (
    <>
      <AppHeader>
        <Link to="/" className="back">← Documents</Link>
      </AppHeader>

      <main className="editor-page">
        <div className="editor-head">
          <input
            className="title-input"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') editor?.commands.focus('start');
            }}
            maxLength={200}
            readOnly={!canEdit}
            aria-label="Document title"
          />
          <span className={`badge ${doc.role}`}>{ROLE_LABELS[doc.role]}</span>
          {doc.role === 'owner' && (
            <button type="button" className="btn primary" onClick={() => setSharing(true)}>
              Share
            </button>
          )}
        </div>

        <div className="editor-meta">
          {doc.role === 'owner' ? (
            <span className="muted">You own this document</span>
          ) : (
            <span className="muted">Owned by {doc.owner.name}</span>
          )}
          {canEdit && <SaveStatus status={status} error={error} onRetry={flush} />}
        </div>

        {canEdit ? (
          <Toolbar editor={editor} />
        ) : (
          <p className="notice">You have view-only access, so this document can't be edited.</p>
        )}

        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </main>

      {sharing && (
        <ShareDialog
          doc={{ ...doc, title: title.trim() || UNTITLED }}
          onChange={onSharesChange}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}

export default function EditorPage() {
  const { id } = useParams();
  const { expire } = useAuth();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError('');

    api.getDocument(id)
      .then((data) => {
        if (!cancelled) setDoc(data.document);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) expire();
        else setError(err.status === 404 ? "This document doesn't exist or you don't have access to it." : err.message);
      });

    return () => { cancelled = true; };
  }, [id, expire]);

  const handleSharesChange = useCallback((shares) => {
    setDoc((current) => ({ ...current, shares }));
  }, []);

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="page">
          <p className="error banner" role="alert">{error}</p>
          <Link to="/">Back to documents</Link>
        </main>
      </>
    );
  }

  if (!doc) {
    return <div className="center-message">Opening document…</div>;
  }

  return <DocumentEditor key={doc.id} doc={doc} onSharesChange={handleSharesChange} />;
}
