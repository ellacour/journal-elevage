"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

export default function Topbar() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setEmail(data.user?.email ?? null)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    // Optionnel: refresh page
    window.location.href = "/"
  }

  const initials = email
    ? email.split("@")[0].slice(0, 2).toUpperCase()
    : "?"

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b flex items-center justify-between px-4">
      <div className="font-medium">Tableau de bord</div>

      <div className="flex items-center gap-3">
        {loading ? (
          <span className="text-sm text-gray-500">…</span>
        ) : email ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white grid place-items-center text-xs">
                {initials}
              </div>
              <div className="text-sm">
                <div className="font-medium">{email}</div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-600 hover:underline"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </>
        ) : (
          <Link
            href="/auth"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            Se connecter
          </Link>
        )}
      </div>
    </header>
  )
}
