import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ShareDialog({ doc, onChange, onClose }) {
  const [people, setPeople] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only used for the email suggestions, so a failure here isn't worth surfacing.
    api.listUsers().then((data) => setPeople(data.users)).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      const { shares } = await action();
      onChange(shares);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await run(() => api.share(doc.id, email.trim(), role));
    if (ok) setEmail('');
  }

  const sharedIds = new Set(doc.shares.map((s) => s.id));
  const suggestions = people.filter((p) => !sharedIds.has(p.id));

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="share-title">Share "{doc.title}"</h2>

        <form className="share-form" onSubmit={handleSubmit}>
          <input
            type="email"
            list="share-suggestions"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            required
            autoFocus
          />
          <datalist id="share-suggestions">
            {suggestions.map((p) => <option key={p.id} value={p.email}>{p.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access level">
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button type="submit" className="btn primary" disabled={busy}>Share</button>
        </form>
        {suggestions.length > 0 && (
          <p className="muted hint">
            Try: {suggestions.map((p) => p.email).join(', ')}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <h3>People with access</h3>
        <ul className="share-list">
          <li>
            <span>
              {doc.owner.name} <span className="muted">(you)</span>
            </span>
            <span className="badge owner">Owner</span>
          </li>
          {doc.shares.map((person) => (
            <li key={person.id}>
              <span>
                {person.name} <span className="muted">{person.email}</span>
              </span>
              <span className="share-controls">
                <select
                  value={person.role}
                  disabled={busy}
                  onChange={(e) => run(() => api.share(doc.id, person.email, e.target.value))}
                  aria-label={`Access level for ${person.name}`}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">View only</option>
                </select>
                <button
                  type="button"
                  className="btn small danger"
                  disabled={busy}
                  onClick={() => run(() => api.unshare(doc.id, person.id))}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>

        <div className="dialog-footer">
          <button type="button" className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
