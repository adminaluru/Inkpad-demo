import { useState } from 'react';
import { useAuth } from '../auth.jsx';

// Matches the accounts seeded by the server (server/src/seed.js).
const DEMO_PASSWORD = 'inkpad-demo';
const DEMO_ACCOUNTS = [
  { name: 'Alice Chen', email: 'alice@inkpad.test' },
  { name: 'Bob Martin', email: 'bob@inkpad.test' },
  { name: 'Carol Diaz', email: 'carol@inkpad.test' },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(nextEmail, nextPassword) {
    setError('');
    setBusy(true);
    try {
      await signIn(nextEmail, nextPassword);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit(email, password);
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="brand">Inkpad</h1>
        <p className="muted">Write, import and share documents.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="muted">
            Demo accounts (password <code>{DEMO_PASSWORD}</code>). Click one to sign in:
          </p>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => submit(account.email, DEMO_PASSWORD)}
            >
              <span>{account.name}</span>
              <span className="muted">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
