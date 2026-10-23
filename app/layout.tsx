import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "nuhz: NU professor and course reviews", template: "%s | nuhz" },
  description: "Search what NU students said about professors and courses in the Prof. Evaluation chat.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eee8" },
    { media: "(prefers-color-scheme: dark)", color: "#121a17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-5 sm:px-6">
          <Link href="/" className="font-display text-lg font-bold">
            nuhz
          </Link>
          <Link href="/about/" className="text-sm text-muted hover:text-ink">
            About
          </Link>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-10 text-sm text-muted sm:px-6">
          Reviews come from the NU student Telegram chat, Prof. Evaluation topic, 2023 to 2026. Authors are not shown.{" "}
          <Link href="/about/" className="underline underline-offset-2 hover:text-ink">
            Request a removal
          </Link>
        </footer>
      </body>
    </html>
  );
}
