"use client";

/* No React state: the active theme lives on <html data-theme>, written by the
   inline script in the layout before first paint. Nothing here renders from it,
   so SSR and hydration always agree. The sun/moon swap is pure CSS. */
export default function ThemeToggle() {
  return (
    <button
      type="button"
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {
          /* private mode: the theme still applies for this session */
        }
      }}
      className="rounded-control p-1.5 text-muted transition-colors hover:bg-fill hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="h-5 w-5 dark:hidden"
      >
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hidden h-5 w-5 dark:block"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
