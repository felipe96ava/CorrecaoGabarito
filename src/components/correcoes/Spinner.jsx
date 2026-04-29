export default function Spinner({ className = 'w-4 h-4 text-blue-600' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
