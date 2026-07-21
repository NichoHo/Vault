import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const noto = Noto_Sans_JP({ variable: "--font-noto", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vault",
  description: "C2C marketplace with self-built identity and escrow",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
};

async function Header() {
  const user = await getUser();
  const navLink = "text-sumi-60 transition-colors hover:text-ink";
  return (
    <header className="sticky top-0 z-30 border-b border-sumi-20 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
          Vault<span className="text-torii">.</span>
        </Link>
        <form action="/search" role="search" className="flex-1">
          <input
            type="search"
            name="q"
            aria-label="Search listings"
            autoComplete="off"
            placeholder="Search listings…"
            className="w-full max-w-md rounded-[6px] border border-sumi-20 bg-paper px-3 py-1.5 text-sm outline-none transition-colors focus:border-indigo focus:bg-surface"
          />
        </form>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/sell"
            className="rounded-[6px] bg-torii px-3 py-1.5 font-medium text-white transition-opacity hover:opacity-90"
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
                  className="hidden text-kohaku transition-colors hover:text-ink sm:inline"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                href="/auth/mfa"
                title="Two-factor authentication"
                className="text-indigo transition-colors hover:text-ink"
              >
                2FA
              </Link>
              <a href="/auth/logout" className={navLink}>
                Sign out
              </a>
            </>
          ) : (
            <a href="/auth/start" className="font-medium text-indigo transition-colors hover:text-ink">
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
    <html lang="en" className={`${inter.variable} ${noto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-[6px] focus-visible:bg-surface focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-sm focus-visible:font-medium"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-sumi-20 py-4 text-center text-xs text-sumi-40">
          Vault — a portfolio project. No real money, simulated everything.
        </footer>
      </body>
    </html>
  );
}
