"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewHorsePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [sex, setSex] = useState("")
  const [sireNumber, setSireNumber] = useState("")

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error) setError(error.message)
      setUserId(data.user?.id ?? null)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!userId) {
      setError("Veuillez vous connecter pour créer un cheval.")
      return
    }
    if (!name.trim()) {
      setError("Le nom est obligatoire.")
      return
    }

    const { error } = await supabase.from("horses").insert([{
      owner_id: userId,            // requis par RLS
      name: name.trim(),
      birthdate: birthdate || null,
      sex: sex || null,
      sire_number: sireNumber || null,
    }])

    if (error) {
      setError(error.message)
      return
    }
    router.push("/horses")
  }

  if (loading) {
    return <div className="p-6">Chargement…</div>
  }

  if (!userId) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Créer un cheval</h1>
        <p className="text-gray-700">Vous devez être connecté.</p>
        <Link href="/auth" className="text-blue-600 hover:underline">Se connecter</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau cheval</h1>
        <Link href="/horses" className="text-sm text-blue-600 hover:underline">← Retour à la liste</Link>
      </div>

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Parissa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date de naissance</label>
            <input
              type="date"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sexe</label>
            <select
              className="w-full p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">—</option>
              <option value="jument">Jument</option>
              <option value="hongre">Hongre</option>
              <option value="entier">Entier</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">N° SIRE</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="250001234567890"
            value={sireNumber}
            onChange={(e) => setSireNumber(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto bg-blue-600 text-white py-3 px-5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Créer le cheval
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-500">
        Astuce : vous pourrez ajouter les soins (vaccins, vermifuges, etc.) dans la prochaine étape.
      </p>
    </div>
  )
}
