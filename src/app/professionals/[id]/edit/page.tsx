// app/(app)/professionals/[id]/edit/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

// === Types ===
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

type Address = {
  id: string
  label: string | null
  line1: string
  line2: string | null
  postal_code: string
  city: string
  country: string | null
  lat: number | null
  lng: number | null
  created_by: string
}

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

  // Adresse (édition)
  const [addrLabel, setAddrLabel] = useState("")
  const [addrLine1, setAddrLine1] = useState("")
  const [addrLine2, setAddrLine2] = useState("")
  const [addrPostal, setAddrPostal] = useState("")
  const [addrCity, setAddrCity] = useState("")
  const [addrCountry, setAddrCountry] = useState("FR")
  const [clearAddress, setClearAddress] = useState(false) // checkbox "Retirer l'adresse"

  // Simple validation helpers
  const phoneError = useMemo(() => {
    if (!phone) return null
    const digits = phone.replace(/\D/g, "")
    return digits.length < 9 ? "Numéro de téléphone invalide" : null
  }, [phone])

  const addressProvided = useMemo(() => {
    return addrLine1.trim() !== "" && addrPostal.trim() !== "" && addrCity.trim() !== ""
  }, [addrLine1, addrPostal, addrCity])

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

      if (error) {
        if (!ignore) { setError(error.message); setLoading(false) }
        return
      }

      const p = data as Professional
      if (!ignore) {
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

      // Load address if any (pré-remplissage uniquement)
      if (p.address_id) {
        const { data: addr, error: aerr } = await supabase
          .from("addresses")
          .select("id, label, line1, line2, postal_code, city, country, lat, lng, created_by")
          .eq("id", p.address_id)
          .single()
        if (!ignore && !aerr && addr) {
          const a = addr as Address
          setAddrLabel(a.label ?? "")
          setAddrLine1(a.line1 ?? "")
          setAddrLine2(a.line2 ?? "")
          setAddrPostal(a.postal_code ?? "")
          setAddrCity(a.city ?? "")
          setAddrCountry(a.country ?? "FR")
        }
      }

      if (!ignore) setLoading(false)
    })()
    return () => { ignore = true }
  }, [id])

  const canEdit = useMemo(() => {
    if (!pro) return false
    return isAdmin || (!!userId && pro.created_by === userId)
  }, [pro, userId, isAdmin])

  async function findOrCreateAddressForUser(): Promise<string | null> {
    if (!userId) return null
    if (!addressProvided) return null

    const norm = (s: string) => s.normalize().trim().toLowerCase()

    const nLine1 = norm(addrLine1)
    const nLine2 = norm(addrLine2 || "")
    const nPostal = norm(addrPostal)
    const nCity  = norm(addrCity)
    const nCountry = norm(addrCountry || "FR")

    // 1) Tenter de retrouver une adresse existante de l'utilisateur (match "normalisé")
    const { data: existing, error: selErr } = await supabase
      .from("addresses")
      .select("id, line1, line2, postal_code, city, country")
      .eq("created_by", userId)
      .ilike("line1", addrLine1.trim()) // heuristique souple (ilike)
      .eq("postal_code", addrPostal.trim())
      .ilike("city", addrCity.trim())
      .eq("country", (addrCountry || "FR").trim())
      .limit(5)

    if (!selErr && existing && existing.length) {
      const match = existing.find(a =>
        norm(a.line1) === nLine1 &&
        norm(a.line2 || "") === nLine2 &&
        norm(a.postal_code) === nPostal &&
        norm(a.city) === nCity &&
        norm(a.country || "fr") === nCountry
      )
      if (match) return match.id
    }

    // 2) Sinon, créer une nouvelle adresse
    const insertPayload = {
      created_by: userId,
      label: addrLabel || null,
      line1: addrLine1.trim(),
      line2: addrLine2 ? addrLine2.trim() : null,
      postal_code: addrPostal.trim(),
      city: addrCity.trim(),
      country: (addrCountry || "FR").trim(),
      lat: null,
      lng: null,
    }

    const { data: inserted, error: insErr } = await supabase
      .from("addresses")
      .insert([insertPayload])
      .select("id")
      .single()

    if (insErr) throw insErr
    return inserted?.id ?? null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return setError("Veuillez vous connecter.")
    if (!pro) return
    if (!displayName.trim()) return setError("Le nom est obligatoire.")
    if (!kind) return setError("Le métier est obligatoire.")
    if (phoneError) return setError(phoneError)

    setSaving(true); setError(null)

    try {
      // Résoudre l'address_id cible selon les champs saisis
      let nextAddressId: string | null = pro.address_id

      if (clearAddress) {
        nextAddressId = null
      } else if (addressProvided) {
        nextAddressId = await findOrCreateAddressForUser()
      } else {
        // adresse non fournie => on détache
        nextAddressId = null
      }

      const payload: Partial<Professional> = {
        display_name: displayName.trim(),
        company_name: companyName || null,
        kind,
        email: email || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        address_id: nextAddressId,
        ...(isAdmin ? { is_verified: isVerified } : {}),
      }

      const { error: upErr } = await supabase
        .from("professionals")
        .update(payload)
        .eq("id", pro.id)

      if (upErr) throw upErr

      setSaving(false)
      router.push(`/professionals/${pro.id}`)
    } catch (e: any) {
      setSaving(false)
      const msg = typeof e?.message === "string" ? e.message : "Erreur lors de l’enregistrement."
      // Message plus clair si contrainte d’unicité adresse côté DB
      const duplicate = /duplicate|already exists|unique/i.test(msg)
      setError(duplicate
        ? "Cette adresse existe déjà dans ton espace. Elle a peut-être déjà été créée pour un autre pro."
        : msg
      )
    }
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

        {/* Adresse */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Adresse</h3>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={clearAddress}
                onChange={(e) => setClearAddress(e.target.checked)}
              />
              Retirer l’adresse (dissocier)
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Libellé</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cabinet, Domicile…"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                disabled={clearAddress}
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Pays</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="FR"
                value={addrCountry}
                onChange={(e) => setAddrCountry(e.target.value)}
                disabled={clearAddress}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-700">Adresse (ligne 1)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12 rue des Écuries"
              value={addrLine1}
              onChange={(e) => setAddrLine1(e.target.value)}
              disabled={clearAddress}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Complément</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bât A, 2e étage…"
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
                disabled={clearAddress}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-sm text-gray-700">CP</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="31540"
                  value={addrPostal}
                  onChange={(e) => setAddrPostal(e.target.value)}
                  disabled={clearAddress}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Ville</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Saint-Félix-Lauragais"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  disabled={clearAddress}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Renseigne <b>ligne 1 + CP + ville</b> pour lier une adresse. Si tu modifies l’adresse,
            une nouvelle entrée sera créée au besoin et associée à ce professionnel.
          </p>
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
