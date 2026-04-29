import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Login from '../pages/Login.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import MinhasProvas from '../pages/MinhasProvas.jsx';
import CadastroProva from '../pages/CadastroProva.jsx';
import EnviarCartoes from '../pages/EnviarCartoes.jsx';
import Resultados from '../pages/Resultados.jsx';
import ResultadoAluno from '../pages/ResultadoAluno.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';

function ProtectedLayout({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/provas"
          element={
            <ProtectedLayout>
              <MinhasProvas />
            </ProtectedLayout>
          }
        />
        <Route
          path="/provas/nova"
          element={
            <ProtectedLayout>
              <CadastroProva />
            </ProtectedLayout>
          }
        />
        <Route
          path="/provas/:id/editar"
          element={
            <ProtectedLayout>
              <CadastroProva />
            </ProtectedLayout>
          }
        />
        <Route
          path="/correcoes"
          element={
            <ProtectedLayout>
              <EnviarCartoes />
            </ProtectedLayout>
          }
        />
        <Route
          path="/resultados/:provaId"
          element={
            <ProtectedLayout>
              <Resultados />
            </ProtectedLayout>
          }
        />
        <Route
          path="/resultados/aluno/:alunoId"
          element={
            <ProtectedLayout>
              <ResultadoAluno />
            </ProtectedLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
