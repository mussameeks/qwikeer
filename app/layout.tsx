import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"

/**
 * Qwikeer root layout.
 *
 * All pages are wrapped in AppShell, which provides:
 * - navigation
 * - auth display
 * - consistent page background
 */

export const metadata: Metadata = {
  title: "Qwikeer — Predict what happens next",
  description: "A clean and fast prediction market platform.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}