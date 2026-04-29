import { useEffect } from 'react';

// Toast simples e auto-dismissable. Renderizado em posição fixa no canto
// inferior direito. Para variantes (success/error) trocamos só a classe.
export default function Toast({ open, message, variant = 'success', durationMs = 4000, onClose }) {
  useEffect(() => {
    if (!open || !durationMs) return undefined;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const cor =
    variant === 'success'
      ? 'bg-green-600'
      : variant === 'error'
        ? 'bg-red-600'
        : 'bg-gray-800';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-fadeIn"
      role="status"
      aria-live="polite"
    >
      <div
        className={`${cor} text-white shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 min-w-[260px] max-w-md`}
      >
        <div className="text-sm flex-1">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white text-lg leading-none"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
