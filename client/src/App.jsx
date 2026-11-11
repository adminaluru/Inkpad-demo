import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import EditorPage from './pages/EditorPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

function Screens() {
  const { user } = useAuth();

  if (user === undefined) {
    return <div className="center-message">Loading…</div>;
  }
  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<DocumentsPage />} />
      <Route path="/d/:id" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  );
}
