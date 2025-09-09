// app/(app)/professionals/[id]/edit/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

// === Types ===
export type Professional = {
  id: string
  display_name: string
  company_name: string | null
  kind: ProfessionKind
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  address_id: string | null
  is_verified: boolean
  created_at: string
  created_by: string | null
}

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

const PROF_KIND_OPTIONS: { value: ProfessionKind; label: string }[] = [
  { value: "coach", label: "Coach" },
  { value: "veterinaire", label: "Vétérinaire" },
  { value: "marechal", label: "Maréchal" },
  { value: "osteopathe", label: "Ostéopathe" },
  { value: "dentiste", label: "Dentiste" },
  { value: "saddle_fitter", label: "Saddle fitter" },
  { value: "physio", label: "Physio" },
  { value: "shiatsu", label: "Shiatsu" },
  { value: "autre", label: "Autre" },
]

export default function EditProfessionalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  const [pro, setPro] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form fields
  const [displayName, setDisplayName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [kind, setKind] = useState<ProfessionKind>("coach")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")
  const [isVerified, setIsVerified] = useState(false)

  // Simple validation helpers
  const phoneError = useMemo(() => {
    if (!phone) return null
    const digits = phone.replace(/\D/g, "")
    return digits.length < 9 ? "Numéro de téléphone invalide" : null
  }, [phone])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError(null)

      // Identify current user & role
      const { data: authData, error: uerr } = await supabase.auth.getUser()
      if (uerr) {
        if (!ignore) { setError(uerr.message); setLoading(false) }
        return
      }

      const uid = authData.user?.id ?? null
      setUserId(uid)

      if (uid) {
        const { data: prof, error: perr } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", uid)
          .single()
        if (!perr && prof) setIsAdmin(prof.role === "admin")
      }

      // Load professional
      const { data, error } = await supabase
        .from("professionals")
        .select(
          "id, display_name, company_name, kind, email, phone, website, notes, address_id, is_verified, created_at, created_by"
        )
        .eq("id", id)
        .single()

      if (!ignore) {
        if (error) {
          setError(error.message)
        } else if (data) {
          const p = data as Professional
          setPro(p)
          setDisplayName(p.display_name ?? "")
          setCompanyName(p.company_name ?? "")
          setKind(p.kind)
          setEmail(p.email ?? "")
          setPhone(p.phone ?? "")
          setWebsite(p.website ?? "")
          setNotes(p.notes ?? "")
          setIsVerified(!!p.is_verified)
        }
        setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [id])

  const canEdit = useMemo(() => {
    if (!pro) return false
    return isAdmin || (!!userId && pro.created_by === userId)
  }, [pro, userId, isAdmin])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return setError("Veuillez vous connecter.")
    if (!pro) return
    if (!displayName.trim()) return setError("Le nom est obligatoire.")
    if (!kind) return setError("Le métier est obligatoire.")
    if (phoneError) return setError(phoneError)

    setSaving(true); setError(null)

    const payload: Partial<Professional> = {
      display_name: displayName.trim(),
      company_name: companyName || null,
      kind,
      email: email || null,
      phone: phone || null,
      website: website || null,
      notes: notes || null,
      // L'admin peut modifier le flag; sinon on ne l'envoie pas (la RLS refusera de toute façon)
      ...(isAdmin ? { is_verified: isVerified } : {}),
    }

    const { error } = await supabase
      .from("professionals")
      .update(payload)
      .eq("id", pro.id)

    setSaving(false)
    if (error) return setError(error.message)

    router.push(`/professionals/${pro.id}`)
  }

  if (loading) return <div className="min-h-screen p-6">Chargement…</div>

  if (!userId)
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Éditer le professionnel</h1>
        <p className="text-gray-600 mb-4">Vous devez être connecté.</p>
        <Link href="/auth" className="text-blue-600 underline">Se connecter</Link>
      </div>
    )

  if (!pro)
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Professionnel introuvable</h1>
        <Link href="/professionals" className="text-blue-600 underline">← Retour à l'annuaire</Link>
      </div>
    )

  if (!canEdit)
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-gray-600">Vous n'avez pas les droits pour modifier ce professionnel.</p>
        <div className="mt-4 flex gap-3">
          <Link href={`/professionals/${pro.id}`} className="text-blue-600 underline">← Retour à la fiche</Link>
          {isAdmin && (
            <button
              onClick={() => router.refresh()}
              className="text-sm text-gray-600 underline"
            >Rafraîchir</button>
          )}
        </div>
      </div>
    )

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Éditer : {pro.display_name}</h1>
        <Link href={`/professionals/${pro.id}`} className="text-sm text-blue-600 hover:underline">
          ← Retour à la fiche
        </Link>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom complet *</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Entreprise</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Écurie Equi-Sud, Clinique X…"
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
              {PROF_KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium mb-1">Site web</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[90px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Disponibilités, secteurs, préférences, etc."
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <input id="isVerified" type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} />
            <label htmlFor="isVerified" className="text-sm">Professionnel vérifié</label>
          </div>
        )}

        <div className="text-xs text-gray-500">Créé le {new Date(pro.created_at).toLocaleString()}</div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 text-white py-3 px-5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  )
}
