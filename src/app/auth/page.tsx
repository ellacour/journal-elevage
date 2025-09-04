"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }

      // 🔽 Création/MAJ du profil (remplace le trigger SQL)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email!,
        })
        if (upsertErr) throw upsertErr
      }
      // 🔼

      setMessage("Succès ✅")
      router.push("/")
    } catch (err: any) {
      setMessage(err?.message ?? "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 text-center">
          {isLogin ? "Connexion" : "Inscription"}
        </h2>

        {message && (
          <p
            className={`text-center text-sm ${
              message.includes("Succès") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {loading ? "Veuillez patienter…" : isLogin ? "Se connecter" : "S’inscrire"}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-sm text-blue-600 hover:underline"
        >
          {isLogin
            ? "Pas encore de compte ? S’inscrire"
            : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </main>
  )
}
