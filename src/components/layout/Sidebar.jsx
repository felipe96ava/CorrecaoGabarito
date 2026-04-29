import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/provas', label: 'Minhas Provas' },
  { to: '/correcoes', label: 'Enviar Cartões' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-56 bg-blue-700 text-white flex flex-col shrink-0">
      <div className="px-5 py-6 font-bold text-xl tracking-tight">CorretoAI</div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive ? 'bg-white text-blue-700' : 'hover:bg-blue-600'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="m-3 px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-blue-600 rounded-lg text-left transition"
      >
        Sair
      </button>
    </aside>
  );
}
