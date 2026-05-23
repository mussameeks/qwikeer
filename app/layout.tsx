import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"
import { Web3Provider } from "@/components/web3-provider"

/**
 * Qwikeer root layout.
 *
 * All pages are wrapped in AppShell, which provides:
 * - navigation
 * - auth display
 * - consistent page background
 */
export const metadata: Metadata = {
  title: "Qwikeer",
  description: "Qwikeer Prediction Markets",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  )
}