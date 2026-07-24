import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import ThemeToggle from "@/components/ThemeToggle";
import { getUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const noto = Noto_Sans_JP({ variable: "--font-noto", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vault",
  description: "C2C marketplace with self-built identity and escrow",
};

/* No `themeColor` viewport export: a media-query-based one would keep painting
   the mobile browser chrome from the OS preference after the user overrides it.
   `color-scheme` on <html> tracks the actual theme instead. */

async function Header() {
  const user = await getUser();
  const navLink = "text-muted transition-colors hover:text-ink";
  return (
    <header className="sticky top-0 z-30 border-b border-line glass">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-ink">
          Vault<span className="text-accent">.</span>
        </Link>
        <form action="/search" role="search" className="flex-1">
          <input
            type="search"
            name="q"
            aria-label="Search listings"
            autoComplete="off"
            placeholder="Search listings…"
            className="w-full max-w-md rounded-control border border-line bg-surface/80 px-3.5 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:bg-surface"
          />
        </form>
        <nav className="flex items-center gap-4 text-sm">
          <ThemeToggle />
          <Link
            href="/sell"
            className="rounded-control bg-accent px-3.5 py-2 font-semibold text-on-solid shadow-sm transition-colors hover:bg-accent-strong"
          >
            Sell
          </Link>
          {user ? (
            <>
              <Link href="/orders" className={`hidden sm:inline ${navLink}`}>
                Orders
              </Link>
              <Link href="/wallet" className={`hidden sm:inline ${navLink}`}>
                Wallet
              </Link>
              {ADMIN_EMAILS.includes(user.email.toLowerCase()) ? (
                <Link
                  href="/admin"
                  className="hidden text-warning transition-colors hover:text-ink sm:inline"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                href="/auth/mfa"
                title="Two-factor authentication"
                className="text-accent transition-colors hover:text-ink"
              >
                2FA
              </Link>
              <a href="/auth/logout" className={navLink}>
                Sign out
              </a>
            </>
          ) : (
            <a
              href="/auth/start"
              className="font-medium text-accent transition-colors hover:text-ink"
            >
              Sign in
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${noto.variable} h-full antialiased`}
      suppressHydrationWarning /* the script below writes data-theme pre-hydration */
    >
      <head>
        {/* Runs while the HTML is parsed, before first paint, so the saved theme
            applies without a flash of the wrong one. Falls back to the OS. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas font-sans">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-control focus-visible:bg-surface focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-sm focus-visible:font-medium focus-visible:text-ink focus-visible:shadow-md"
        >
          Skip to content
        </a>
        <Header />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
        >
          <BackLink />
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-faint">
          Vault is a portfolio project. No real money, simulated everything.
        </footer>
      </body>
    </html>
  );
}
