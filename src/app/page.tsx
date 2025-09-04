"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserEmail(data.user.email ?? null)
    })
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Bienvenue 👋</h1>
      {userEmail ? (
        <p className="text-gray-700">Connecté en tant que <strong>{userEmail}</strong></p>
      ) : (
        <Link href="/auth" className="text-blue-600 hover:underline">Se connecter</Link>
      )}

      <div className="grid gap-3 max-w-xl">
        <Link
          href="/horses"
          className="bg-white border rounded-lg p-4 hover:shadow"
        >
          → Gérer mes chevaux
        </Link>
      </div>
    </div>
  )
}
