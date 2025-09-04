"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

type SexDb = "mare" | "stallion" | "gelding" | "unknown" | null

type Horse = {
  id: string
  name: string
  birthdate: string | null
  sex: SexDb
  sire_number: string | null
  created_at: string
}

const sexInputToDb: Record<string, Exclude<SexDb, null>> = {
  "": "unknown",
  "jument": "mare",
  "hongre": "gelding",
  "entier": "stallion",
}

const sexDbToLabel: Record<Exclude<SexDb, null>, string> = {
  mare: "Jument",
  gelding: "Hongre",
  stallion: "Entier",
  unknown: "—",
}

export default function HorsesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [open, setOpen] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [sex, setSex] = useState("")            // jument/hongre/entier (ou vide)
  const [sire_numberNumber, setsire_numberNumber] = useState("") // on stocke dans `sire_number`
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError(null)

      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) {
        if (!ignore) setError(userErr.message)
        setLoading(false)
        return
      }
      if (!user) {
        if (!ignore) setLoading(false)
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from("horses")
        .select("id,name,birthdate,sex,sire_number,created_at")
        .order("created_at", { ascending: false })

      if (!ignore) {
        if (error) setError(error.message)
        else setHorses((data ?? []) as Horse[])
        setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return setError("Veuillez vous connecter.")
    if (!name.trim()) return setError("Le nom est obligatoire.")

    setSaving(true)
    setError(null)

    const payload = {
      owner_id: userId,
      name: name.trim(),
      birthdate: birthdate || null,
      sex: sexInputToDb[sex] ?? "unknown",
      sire_number: sire_numberNumber || null,
    }

    const { data, error } = await supabase
      .from("horses")
      .insert([payload])
      .select("id,name,birthdate,sex,sire_number,created_at")
      .single()

    setSaving(false)
    if (error) return setError(error.message)

    // reset + prepend + close
    setName(""); setBirthdate(""); setSex(""); setsire_numberNumber("")
    if (data) setHorses(prev => [data as Horse, ...prev])
    setOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce cheval ?")) return
    const { error } = await supabase.from("horses").delete().eq("id", id)
    if (error) return setError(error.message)
    setHorses(prev => prev.filter(h => h.id !== id))
  }

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString() : ""

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="max-w-3xl mx-auto text-center text-gray-600">Chargement…</div>
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">Mes chevaux</h1>
          <p className="text-gray-600">Vous n’êtes pas connecté.</p>
          <Link href="/auth" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Se connecter / S’inscrire
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mes chevaux</h1>
            <p className="text-sm text-gray-500">Gère la liste de tes chevaux. Les soins arrivent en V2.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-600 hover:underline">← Accueil</Link>
            <button onClick={() => setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Ajouter un cheval
            </button>
          </div>
        </header>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

        {horses.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-10 text-center space-y-4">
            <div className="text-5xl">🐴</div>
            <h2 className="text-xl font-semibold">Aucun cheval pour l’instant</h2>
            <p className="text-gray-500">Ajoute ton premier cheval pour commencer ton journal d’élevage.</p>
            <button onClick={() => setOpen(true)} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Ajouter un cheval
            </button>
          </section>
        ) : (
          <section className="grid gap-3">
            {horses.map((h) => (
              <article key={h.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/horses/${h.id}`} className="text-lg font-semibold hover:underline">
                      {h.name}
                    </Link>
                    <p className="text-sm text-gray-600">
                      {h.sex ? `Sexe : ${h.sex}` : ""}
                      {h.birthdate ? `${h.sex ? " · " : ""}Naissance : ${formatDate(h.birthdate)}` : ""}
                      {!h.sex && !h.birthdate ? "—" : ""}
                    </p>
                    {h.sire_number && <p className="text-sm text-gray-600">N° sire_number : {h.sire_number}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/horses/${h.id}`} className="text-sm text-blue-600 hover:underline">
                      Voir la fiche
                    </Link>
                    <button onClick={() => handleDelete(h.id)} className="text-sm text-red-600 hover:text-red-700">
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un cheval</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-sm text-gray-700">Nom *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Parissa" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Date de naissance</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Sexe</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="">—</option>
                    <option value="jument">Jument</option>
                    <option value="hongre">Hongre</option>
                    <option value="entier">Entier</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700">N° sire_number</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="250001234567890" value={sire_numberNumber} onChange={(e) => setsire_numberNumber(e.target.value)} />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Ajout..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
