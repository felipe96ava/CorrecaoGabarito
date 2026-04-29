import { useAuth } from '../../hooks/useAuth.js';

export default function TopBar() {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
      <span className="text-sm text-gray-500">{user?.unidade || 'SESI'}</span>
      <span className="text-sm font-medium text-gray-700">{user?.nome}</span>
    </header>
  );
}
