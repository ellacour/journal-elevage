import "./globals.css"
import type { Metadata } from "next"
import Sidebar from "@/components/Sidebar"
import Topbar from "@/components/Topbar"

export const metadata: Metadata = {
  title: "Journal d'Élevage",
  description: "MVP Supabase + Next.js",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50" suppressHydrationWarning>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* Zone principale */}
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
