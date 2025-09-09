// app/(app)/professionals/new/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"

// --- Types ---
export type ProfessionKind =
  | "coach"
  | "veterinaire"
  | "marechal"
  | "osteopathe"
  | "dentiste"
  | "saddle_fitter"
  | "physio"
  | "shiatsu"
  | "autre"

const KIND_LABEL: Record<ProfessionKind, string> = {
  coach: "Coach",
  veterinaire: "Vétérinaire",
  marechal: "Maréchal",
  osteopathe: "Ostéopathe",
  dentiste: "Dentiste",
  saddle_fitter: "Saddle fitter",
  physio: "Physio",
  shiatsu: "Shiatsu",
  autre: "Autre",
}

export default function NewProfessionalPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [kind, setKind] = useState<ProfessionKind>("coach")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")

  // Helpers
  const normPhone = (s: string) => s.replace(/\D/g, "")
  const phoneError = useMemo(() => {
    if (!phone) return null
    const d = normPhone(phone)
    return d.length < 9 ? "Numéro de téléphone invalide" : null
  }, [phone])

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error) setError(error.message)
      setUserId(data.user?.id ?? null)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!userId) return setError("Veuillez vous connecter pour créer un professionnel.")
    if (!displayName.trim()) return setError("Le nom complet est obligatoire.")
    if (phoneError) return setError(phoneError)

    setSaving(true)

    // --- Dédup légère avant insert ---
    const emailTrim = email.trim()
    const phoneDigits = normPhone(phone)

    // 1) par email + métier
    if (emailTrim) {
      const { data: byEmail } = await supabase
        .from("professionals")
        .select("id")
        .eq("kind", kind)
        .eq("email", emailTrim)
        .limit(1)
      if (byEmail && byEmail.length) {
        setSaving(false)
        router.push(`/professionals/${byEmail[0].id}`)
        return
      }
    }

    // 2) par téléphone (digits) + métier
    if (phoneDigits) {
      const { data: byPhone } = await supabase
        .from("professionals")
        .select("id, phone")
        .eq("kind", kind)
        .ilike("phone", `%${phoneDigits}%`)
        .limit(1)
      if (byPhone && byPhone.length) {
        setSaving(false)
        router.push(`/professionals/${byPhone[0].id}`)
        return
      }
    }

    // --- Insert ---
    const payload = {
      display_name: displayName.trim(),
      company_name: companyName || null,
      kind,
      email: emailTrim || null,
      phone: phone || null,
      website: website || null,
      notes: notes || null,
      created_by: userId, // compatible avec la policy INSERT
    }

    const { data, error } = await supabase
      .from("professionals")
      .insert([payload])
      .select("id")
      .single()

    if (error) {
      // Cas de course: si unique violation, retrouver l'existant et rediriger
      const duplicate = (error as any)?.code === "23505" || /duplicate|unique/i.test(error.message)
      if (duplicate) {
        let targetId: string | null = null
        if (emailTrim) {
          const { data: byMail } = await supabase
            .from("professionals")
            .select("id")
            .eq("kind", kind)
            .eq("email", emailTrim)
            .limit(1)
          targetId = byMail?.[0]?.id ?? null
        }
        if (!targetId && phoneDigits) {
          const { data: byPh } = await supabase
            .from("professionals")
            .select("id")
            .eq("kind", kind)
            .ilike("phone", `%${phoneDigits}%`)
            .limit(1)
          targetId = byPh?.[0]?.id ?? null
        }
        setSaving(false)
        if (targetId) return router.push(`/professionals/${targetId}`)
      }
      setSaving(false)
      return setError(error.message)
    }

    setSaving(false)
    router.push(`/professionals/${data?.id}`)
  }

  if (loading) return <div className="p-6">Chargement…</div>

  if (!userId) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Créer un professionnel</h1>
        <p className="text-gray-700">Vous devez être connecté.</p>
        <Link href="/auth" className="text-blue-600 hover:underline">Se connecter</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau professionnel</h1>
        <Link href="/professionals" className="text-sm text-blue-600 hover:underline">← Retour à la liste</Link>
      </div>

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom complet *</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Myriam Dupont"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Métier *</label>
            <select
              className="w-full p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={kind}
              onChange={(e) => setKind(e.target.value as ProfessionKind)}
            >
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Entreprise</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Écurie Equi-Sud, Clinique X…"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pro@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Téléphone</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
            />
            {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Site web</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Infos utiles (secteur, délais…)"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 text-white py-3 px-5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Création…" : "Créer le professionnel"}
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-500">
        Astuce : ajoute ensuite ce professionnel à la fiche d’un cheval pour planifier des interventions.
      </p>
    </div>
  )
}
