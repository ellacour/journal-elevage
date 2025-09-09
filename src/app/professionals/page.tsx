// app/(app)/professionals/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

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
  is_verified: boolean
  created_at: string
  created_by: string | null
}

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

export default function ProfessionalsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [pros, setPros] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<ProfessionKind | "">("")

  // Modal state
  const [open, setOpen] = useState(false)

  // Form state (create)
  const [displayName, setDisplayName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [kindCreate, setKindCreate] = useState<ProfessionKind>("coach")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Helpers
  const normPhone = (s: string) => s.replace(/\D/g, "")

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError(null)

      // Current user
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) {
        if (!ignore) setError(uerr.message)
        setLoading(false)
        return
      }
      if (!user) {
        if (!ignore) setLoading(false)
        return
      }
      setUserId(user.id)

      // Role
      const { data: me } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single()
      if (me?.role === "admin") setIsAdmin(true)

      // Initial fetch
      await fetchList()
      if (!ignore) setLoading(false)
    })()
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchList() {
    let query = supabase
      .from("professionals")
      .select("id, display_name, company_name, kind, email, phone, website, notes, is_verified, created_at, created_by")
      .order("display_name", { ascending: true })

    if (q.trim()) {
      const term = q.trim()
      query = query.or(
        `display_name.ilike.%${term}%,company_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
      )
    }
    if (kind) query = query.eq("kind", kind)

    const { data, error } = await query
    if (error) return setError(error.message)
    setPros((data ?? []) as Professional[])
  }

  const filtered = useMemo(() => pros, [pros])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return setError("Veuillez vous connecter.")
    if (!displayName.trim()) return setError("Le nom est obligatoire.")

    setSaving(true); setError(null)

    // Déduplication simple côté client : si email + kind déjà présent ⇒ utiliser l'existant
    if (email.trim()) {
      const { data: existingByEmail } = await supabase
        .from("professionals")
        .select("id")
        .eq("kind", kindCreate)
        .eq("email", email.trim())
        .limit(1)
      if (existingByEmail && existingByEmail.length) {
        setSaving(false)
        setOpen(false)
        // Aller à la fiche existante
        window.location.href = `/professionals/${existingByEmail[0].id}`
        return
      }
    }

    // Tentative d'insert
    const payload = {
      display_name: displayName.trim(),
      company_name: companyName || null,
      kind: kindCreate,
      email: email || null,
      phone: phone || null,
      website: website || null,
      notes: notes || null,
      created_by: userId, // requis par RLS (si pas de trigger set_created_by)
    }

    const { data, error } = await supabase
      .from("professionals")
      .insert([payload])
      .select("id, display_name, company_name, kind, email, phone, website, notes, is_verified, created_at, created_by")
      .single()

    // Gestion duplicate (email ou phone)
    if (error) {
      const duplicate = /duplicate key|unique constraint|23505/.test(error.message || "")
      if (duplicate) {
        // Rechercher celui existant via email (prioritaire) puis phone
        let targetId: string | null = null
        if (email) {
          const { data: byMail } = await supabase.from("professionals").select("id").eq("kind", kindCreate).eq("email", email).limit(1)
          targetId = byMail?.[0]?.id ?? null
        }
        if (!targetId && phone) {
          const digits = normPhone(phone)
          const { data: byPhone } = await supabase
            .from("professionals")
            .select("id, phone")
            .eq("kind", kindCreate)
            .ilike("phone", `%${digits}%`)
            .limit(1)
          targetId = byPhone?.[0]?.id ?? null
        }
        setSaving(false)
        setOpen(false)
        if (targetId) {
          window.location.href = `/professionals/${targetId}`
          return
        } else {
          setError("Ce professionnel existe déjà (même email/téléphone).")
          return
        }
      } else {
        setSaving(false)
        setError(error.message)
        return
      }
    }

    // Success
    setSaving(false)
    setOpen(false)

    // Reset form
    setDisplayName(""); setCompanyName(""); setKindCreate("coach"); setEmail(""); setPhone(""); setWebsite(""); setNotes("")

    if (data) setPros(prev => [data as Professional, ...prev].sort((a, b) => a.display_name.localeCompare(b.display_name)))
  }

  async function handleDelete(id: string, created_by: string | null) {
    if (!userId) return setError("Veuillez vous connecter.")
    if (!(isAdmin || (created_by && created_by === userId))) {
      return setError("Vous n'avez pas les droits pour supprimer ce professionnel.")
    }
    if (!confirm("Supprimer ce professionnel ?")) return
    const { error } = await supabase.from("professionals").delete().eq("id", id)
    if (error) return setError(error.message)
    setPros(prev => prev.filter(p => p.id !== id))
  }

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
          <h1 className="text-2xl font-bold">Annuaire des professionnels</h1>
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
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Annuaire des professionnels</h1>
            <p className="text-sm text-gray-500">Réutilise les fiches déjà créées pour éviter les doublons.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-600 hover:underline">← Accueil</Link>
            <button onClick={() => setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Ajouter un professionnel
            </button>
          </div>
        </header>

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fetchList() }}
            placeholder="Rechercher (nom, entreprise, email, téléphone)"
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les métiers</option>
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <button onClick={fetchList} className="px-4 py-2 rounded-lg bg-gray-900 text-white">Filtrer</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

        {filtered.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-10 text-center space-y-4">
            <div className="text-5xl">👩‍⚕️</div>
            <h2 className="text-xl font-semibold">Aucun professionnel</h2>
            <p className="text-gray-500">Ajoute un professionnel (coach, véto, maréchal…) pour commencer.</p>
            <button onClick={() => setOpen(true)} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Ajouter un professionnel
            </button>
          </section>
        ) : (
          <section className="grid gap-3">
            {filtered.map((p) => (
              <article key={p.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/professionals/${p.id}`} className="text-lg font-semibold hover:underline flex items-center gap-2">
                      {p.display_name}
                      {p.is_verified && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-full bg-green-100 text-green-800 border">Vérifié</span>
                      )}
                    </Link>
                    <p className="text-sm text-gray-600">
                      <span>{KIND_LABEL[p.kind]}</span>
                      {p.company_name ? <> · <span className="font-medium">{p.company_name}</span></> : null}
                    </p>
                    <p className="text-sm text-gray-600">
                      {p.email ? <a href={`mailto:${p.email}`} className="underline">{p.email}</a> : "—"}
                      {p.phone ? <> · <a href={`tel:${p.phone.replace(/\s+/g, "")}`} className="underline">{p.phone}</a></> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/professionals/${p.id}`} className="text-sm text-blue-600 hover:underline">Voir la fiche</Link>
                    {(isAdmin || (userId && p.created_by === userId)) && (
                      <button onClick={() => handleDelete(p.id, p.created_by)} className="text-sm text-red-600 hover:text-red-700">Supprimer</button>
                    )}
                  </div>
                </div>
              </article>) )}
          </section>
        )}
      </div>

      {/* MODAL CREATE */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un professionnel</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-sm text-gray-700">Nom complet *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Myriam Dupont" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Métier *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={kindCreate} onChange={(e) => setKindCreate(e.target.value as ProfessionKind)}>
                    {Object.entries(KIND_LABEL).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Entreprise</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Écurie Equi-Sud, Clinique X…" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Email</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pro@example.com" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Téléphone</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Site web</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Notes</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Infos utiles (secteur, délais…)" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
