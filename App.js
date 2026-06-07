import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginPage          from './pages/LoginPage';
import EmployeApp         from './pages/EmployeApp';
import EmployeurDashboard from './pages/EmployeurDashboard';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', color:'#333', fontSize:11, letterSpacing:3 }}>
      CHARGEMENT…
    </div>
  );

  if (!user) return <LoginPage />;

  if (profile?.role === 'employeur') return <EmployeurDashboard />;

  return <EmployeApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
