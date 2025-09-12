'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Horse = {
  id: string
  name: string
  birthdate: string | null
  sex: 'jument' | 'hongre' | 'entier' | null
  sire_number: string | null
  photo_url: string | null
  created_at: string
}
type Movement = {
  id: string
  depart_at: string | null
  return_at: string | null
  reason: string | null
  transport: 'unknown' | 'van' | 'truck' | 'on_foot' | 'other'
  manual: boolean
  created_at: string

  // IDs bruts
  professional_id: string | null
  to_address_id: string
  from_address_id: string | null
  intervention_id: string | null

  // Données jointées (remplies côté JS)
  professional?: { display_name: string | null } | null
  to?: { label: string | null; city: string | null } | null
  from?: { label: string | null; city: string | null } | null
  intervention?: { title: string | null } | null
}

const BUCKET = 'horse-photos'

export default function HorseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [horse, setHorse] = useState<Horse | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [movLoading, setMovLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movError, setMovError] = useState<string | null>(null)

  // --- Load horse ---
  useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!id) return
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('horses')
        .select('id,name,birthdate,sex,sire_number,photo_url,created_at')
        .eq('id', id)
        .single()

      if (ignore) return

      if (error) {
        setError(error.message)
        setHorse(null)
        setSignedUrl(null)
      } else {
        const h = data as Horse
        setHorse(h)
        if (h.photo_url) {
          const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(h.photo_url, 3600)
          setSignedUrl(s?.signedUrl ?? null)
        } else {
          setSignedUrl(null)
        }
      }
      setLoading(false)
    })()

    return () => { ignore = true }
  }, [id])

// --- Load movements without embed; then join via separate queries ---
useEffect(() => {
  if (!id) return
  let ignore = false

  function uniq<T>(arr: (T | null | undefined)[]): T[] {
    return Array.from(new Set(arr.filter(Boolean) as T[]))
  }

  ;(async () => {
    setMovLoading(true)
    setMovError(null)

    // 1) Charger les mouvements "nus"
    const { data: mvts, error: mErr } = await supabase
      .from('horse_movements')
      .select(
        'id, depart_at, return_at, reason, transport, manual, created_at, professional_id, to_address_id, from_address_id, intervention_id'
      )
      .eq('horse_id', id)
      .order('depart_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (ignore) return

    if (mErr) {
      setMovError(mErr.message)
      setMovements([])
      setMovLoading(false)
      return
    }

    const list = (mvts ?? []) as Movement[]

    // 2) Collecter les IDs à joindre
    const proIds = uniq<string>(list.map(m => m.professional_id))
    const toAddrIds = uniq<string>(list.map(m => m.to_address_id))
    const fromAddrIds = uniq<string>(list.map(m => m.from_address_id))
    const intIds = uniq<string>(list.map(m => m.intervention_id))

    // 3) Charger en parallèle
    const [
      prosRes,
      toAddrsRes,
      fromAddrsRes,
      interRes
    ] = await Promise.all([
      proIds.length
        ? supabase.from('professionals').select('id, display_name').in('id', proIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      toAddrIds.length
        ? supabase.from('addresses').select('id, label, city').in('id', toAddrIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      fromAddrIds.length
        ? supabase.from('addresses').select('id, label, city').in('id', fromAddrIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      intIds.length
        ? supabase.from('interventions').select('id, title').in('id', intIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    if (ignore) return

    // 4) Gestion erreurs secondaires (on n’échoue pas tout, on loggue)
    const subErr =
      prosRes.error?.message ||
      toAddrsRes.error?.message ||
      fromAddrsRes.error?.message ||
      interRes.error?.message ||
      null
    if (subErr) {
      console.warn('Join warnings:', subErr)
    }

    // 5) Indexer par id
    const prosById = new Map<string, { display_name: string | null }>()
    ;(prosRes.data ?? []).forEach((p: any) => prosById.set(p.id, { display_name: p.display_name }))

    const addrById = new Map<string, { label: string | null; city: string | null }>()
    ;([...(toAddrsRes.data ?? []), ...(fromAddrsRes.data ?? [])] as any[]).forEach((a) =>
      addrById.set(a.id, { label: a.label ?? null, city: a.city ?? null })
    )

    const interById = new Map<string, { title: string | null }>()
    ;(interRes.data ?? []).forEach((i: any) => interById.set(i.id, { title: i.title ?? null }))

    // 6) Recomposer la liste
    const enriched = list.map(m => ({
      ...m,
      professional: m.professional_id ? prosById.get(m.professional_id) ?? null : null,
      to: addrById.get(m.to_address_id) ?? null,
      from: m.from_address_id ? addrById.get(m.from_address_id) ?? null : null,
      intervention: m.intervention_id ? interById.get(m.intervention_id) ?? null : null,
    }))

    setMovements(enriched)
    setMovLoading(false)
  })()

  return () => { ignore = true }
}, [id])


  const sexLabel = (s?: Horse['sex']) =>
    s === 'jument' ? 'Jument' : s === 'hongre' ? 'Hongre' : s === 'entier' ? 'Entier' : '—'
  const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—')
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

  if (loading) return <div>Chargement…</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!horse) return <div>Cheval introuvable</div>

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{horse.name}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/horses/${horse.id}/movements/new`}
            className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Enregistrer un déplacement
          </Link>
          <Link
            href={`/horses/${horse.id}/edit`}
            className="px-3 py-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            Éditer
          </Link>
          <button
            onClick={() => router.back()}
            className="px-3 py-1 rounded-xl bg-gray-200 hover:bg-gray-300"
          >
            Retour
          </button>
        </div>
      </div>

      {/* Photo */}
      {signedUrl ? (
        <img
          src={signedUrl}
          alt={horse.name}
          className="w-full h-64 object-cover rounded-xl border"
        />
      ) : (
        <div className="w-full h-64 rounded-xl border bg-gray-100 grid place-items-center text-gray-500">
          Aucune photo
        </div>
      )}

      {/* Infos cheval */}
      <div className="p-4 bg-white rounded-xl shadow space-y-2">
        <p><span className="font-medium">N° SIRE :</span> {horse.sire_number ?? '—'}</p>
        <p><span className="font-medium">Date de naissance :</span> {fmtDate(horse.birthdate)}</p>
        <p><span className="font-medium">Sexe :</span> {sexLabel(horse.sex)}</p>
        <p className="text-sm text-gray-500">Fiche créée le {fmtDateTime(horse.created_at)}</p>
      </div>

      {/* Déplacements */}
      <section className="p-4 bg-white rounded-xl shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Déplacements</h2>
          <Link
            href={`/horses/${horse.id}/movements/new`}
            className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            + Nouveau
          </Link>
        </div>

        {movLoading && <div>Chargement des déplacements…</div>}
        {movError && <div className="text-red-600">{movError}</div>}

        {!movLoading && !movError && movements.length === 0 && (
          <div className="flex items-center justify-between rounded-lg border p-3 text-gray-600">
            <span>Aucun déplacement enregistré.</span>
            <Link
              href={`/horses/${horse.id}/movements/new`}
              className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Enregistrer un déplacement
            </Link>
          </div>
        )}

        {!movLoading && !movError && movements.length > 0 && (
          <ul className="divide-y">
            {movements.map((m) => {
              const fromTxt = m.from
                ? [m.from.label, m.from.city].filter(Boolean).join(' · ')
                : '—'
              const toTxt = m.to
                ? [m.to.label, m.to.city].filter(Boolean).join(' · ')
                : '—'
              const tag = m.manual ? 'Saisi manuellement' : 'Automatique'
              const transportLabel =
                m.transport === 'van' ? 'Van'
                : m.transport === 'truck' ? 'Camion'
                : m.transport === 'on_foot' ? 'À pied'
                : m.transport === 'other' ? 'Autre'
                : 'Inconnu'

              return (
                <li key={m.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {m.reason ?? m.intervention?.title ?? 'Déplacement'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${m.manual ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {tag}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {transportLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">De :</span> {fromTxt}
                        {'  '}<span className="font-medium ml-2">Vers :</span> {toTxt}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Départ :</span> {fmtDateTime(m.depart_at)}{' '}
                        <span className="font-medium ml-2">Retour :</span> {fmtDateTime(m.return_at)}
                      </p>
                      {m.professional?.display_name && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Professionnel :</span> {m.professional.display_name}
                        </p>
                      )}
                    </div>
                    {/* Actions futures (éditer/supprimer) */}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
