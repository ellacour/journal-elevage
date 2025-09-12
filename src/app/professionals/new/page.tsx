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

  // --- Adresse (optionnel)
  const [addrLabel, setAddrLabel] = useState("")
  const [addrLine1, setAddrLine1] = useState("")
  const [addrLine2, setAddrLine2] = useState("")
  const [addrPostal, setAddrPostal] = useState("")
  const [addrCity, setAddrCity] = useState("")
  const [addrCountry, setAddrCountry] = useState("FR")
  // (lat/lng plus tard si besoin)

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
    return () => { mounted = false }
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
        .eq("email", emailTrim) // citext => eq ok
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

    // --- Insert via RPC (adresse + pro en une fois) ---
    const { data: rpcData, error: rpcError } = await supabase.rpc("create_professional_with_address", {
      p_display_name: displayName.trim(),
      p_company_name: companyName || null,
      p_kind: kind,
      p_email: emailTrim || null,
      p_phone: phone || null,
      p_website: website || null,
      p_notes: notes || null,

      p_label: addrLabel || null,
      p_line1: addrLine1 || null,
      p_line2: addrLine2 || null,
      p_postal_code: addrPostal || null,
      p_city: addrCity || null,
      p_country: addrCountry || null,
      p_lat: null,
      p_lng: null,
    })

    if (rpcError) {
      const duplicate = /duplicate|already exists|unique/i.test(rpcError.message)
      setSaving(false)
      return setError(
        duplicate
          ? "Cette adresse existe déjà dans ton espace. Elle a peut-être déjà été créée pour un autre pro."
          : rpcError.message
      )
    }

    setSaving(false)
    router.push(`/professionals/${rpcData}`)
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

        {/* --- Adresse (optionnel) --- */}
        <div className="border-t pt-4 space-y-4">
          <h2 className="text-lg font-semibold">Adresse (optionnel)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Libellé</label>
              <input
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cabinet, Domicile…"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pays</label>
              <input
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={addrCountry}
                onChange={(e) => setAddrCountry(e.target.value)}
                placeholder="FR"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse (ligne 1)</label>
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12 rue des Écuries"
              value={addrLine1}
              onChange={(e) => setAddrLine1(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Complément</label>
              <input
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bât A, 2e étage…"
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-sm font-medium mb-1">CP</label>
                <input
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="31540"
                  value={addrPostal}
                  onChange={(e) => setAddrPostal(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Ville</label>
                <input
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Saint-Félix-Lauragais"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Si tu renseignes <b>ligne 1 + CP + ville</b>, l’adresse sera créée et liée automatiquement.
          </p>
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
