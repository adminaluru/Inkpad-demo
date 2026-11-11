import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AppHeader from '../components/AppHeader.jsx';
import { ROLE_LABELS, formatUpdatedAt } from '../format.js';

const ACCEPTED = ['.txt', '.md', '.docx'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function DocumentRow({ doc, onDelete }) {
  const owned = doc.role === 'owner';

  let detail;
  if (!owned) {
    detail = `Shared by ${doc.ownerName}`;
  } else if (doc.shareCount > 0) {
    detail = `Shared with ${doc.shareCount} ${doc.shareCount === 1 ? 'person' : 'people'}`;
  } else {
    detail = 'Private';
  }

  return (
    <li className="doc-row">
      <Link to={`/d/${doc.id}`} className="doc-link">
        <span className="doc-title">{doc.title}</span>
        <span className="muted">{detail} · Edited {formatUpdatedAt(doc.updatedAt)}</span>
      </Link>
      <span className={`badge ${doc.role}`}>{ROLE_LABELS[doc.role]}</span>
      {owned && (
        <button
          type="button"
          className="btn small danger"
          onClick={() => onDelete(doc)}
          aria-label={`Delete ${doc.title}`}
        >
          Delete
        </button>
      )}
    </li>
  );
}

export default function DocumentsPage() {
  const { expire } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = useCallback((err) => {
    if (err.status === 401) expire();
    else setError(err.message);
  }, [expire]);

  const load = useCallback(() => {
    return api.listDocuments()
      .then((data) => setDocuments(data.documents))
      .catch(fail);
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setError('');
    setBusy(true);
    try {
      const { document } = await api.createDocument();
      navigate(`/d/${document.id}`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }

  async function handleFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const supported = ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!supported) {
      setError(`"${file.name}" isn't a supported file type. Upload a ${ACCEPTED.join(', ')} file.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That file is too large. The limit is 2 MB.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      const { document } = await api.importDocument(file);
      navigate(`/d/${document.id}`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    setError('');
    try {
      await api.deleteDocument(doc.id);
      setDocuments((current) => current.filter((d) => d.id !== doc.id));
    } catch (err) {
      fail(err);
    }
  }

  const owned = documents?.filter((d) => d.role === 'owner') ?? [];
  const shared = documents?.filter((d) => d.role !== 'owner') ?? [];

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="actions">
          <button type="button" className="btn primary" onClick={handleCreate} disabled={busy}>
            New document
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current.click()} disabled={busy}>
            Upload file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={handleFile}
            hidden
            data-testid="file-input"
          />
          <span className="muted">
            Uploading a .txt, .md or .docx file (up to 2 MB) creates a new document from it.
          </span>
        </div>

        {error && <p className="error banner" role="alert">{error}</p>}

        {documents === null && !error && <p className="muted">Loading documents…</p>}

        {documents !== null && (
          <>
            <section>
              <h2>My documents</h2>
              {owned.length === 0 ? (
                <p className="empty">You haven't created any documents yet.</p>
              ) : (
                <ul className="doc-list">
                  {owned.map((doc) => <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} />)}
                </ul>
              )}
            </section>

            <section>
              <h2>Shared with me</h2>
              {shared.length === 0 ? (
                <p className="empty">Documents other people share with you will show up here.</p>
              ) : (
                <ul className="doc-list">
                  {shared.map((doc) => <DocumentRow key={doc.id} doc={doc} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
