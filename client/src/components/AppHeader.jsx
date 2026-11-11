import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function AppHeader({ children }) {
  const { user, signOut } = useAuth();

  return (
    <header className="app-header">
      <Link to="/" className="brand">Inkpad</Link>
      <div className="app-header-middle">{children}</div>
      <div className="app-header-user">
        <span className="muted" title={user.email}>{user.name}</span>
        <button type="button" className="btn small" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
