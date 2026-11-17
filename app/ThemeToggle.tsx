"use client";

// The theme lives in <html data-theme>; the icons are swapped by CSS, so no state is needed and there is no hydration mismatch.
export default function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  }

  return (
    <button onClick={toggle} aria-label="Cambiar entre modo claro y oscuro" title="Cambiar tema"
      className="fixed right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-ink transition hover:scale-105 active:scale-95">
      <svg className="theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
