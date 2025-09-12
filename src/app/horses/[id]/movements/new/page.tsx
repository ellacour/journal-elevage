'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Professional = {
  id: string
  display_name: string
  address_id: string | null
}

type DestinationType = 'professional' | 'external'

type AddressDraft = {
  label: string
  line1: string
  line2?: string
  postal_code: string
  city: string
  country: string
}

const EMPTY_ADDR: AddressDraft = {
  label: '',
  line1: '',
  postal_code: '',
  city: '',
  country: 'FR',
}

export default function NewMovementPage() {
  const { id: horseId } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lieu de départ (détention courante)
  const [fromAddressId, setFromAddressId] = useState<string | null>(null)

  // Sélection destination
  const [destType, setDestType] = useState<DestinationType>('professional')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProId, setSelectedProId] = useState<string>('')

  // Adresse externe (si destType === 'external')
  const [extAddr, setExtAddr] = useState<AddressDraft>({ ...EMPTY_ADDR })

  // Champs déplacement
  const [departAt, setDepartAt] = useState<string>('')   // datetime-local
  const [returnAt, setReturnAt] = useState<string>('')   // datetime-local
  const [reason, setReason] = useState<string>('')
  const [transport, setTransport] = useState<'unknown' | 'van' | 'truck' | 'on_foot' | 'other'>('unknown')

  const canSubmit = useMemo(() => {
    if (!horseId) return false
    if (!departAt) return false
    if (destType === 'professional') return !!selectedProId
    if (destType === 'external') {
      return !!extAddr.label && !!extAddr.line1 && !!extAddr.city && !!extAddr.postal_code && !!extAddr.country
    }
    return false
  }, [horseId, departAt, destType, selectedProId, extAddr])

  // Charger detention courante + pros
  useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!horseId) return
      setLoading(true)
      setError(null)

      // 1) Adresse de détention courante
      const { data: rpcData, error: rpcErr } = await supabase.rpc('current_detention_address_id', { p_horse: horseId })
      if (ignore) return
      if (rpcErr) {
        setError(`Impossible de récupérer le lieu de détention: ${rpcErr.message}`)
      } else {
        setFromAddressId(rpcData ?? null)
      }

      // 2) Liste des pros avec adresse
      const { data: pros, error: prosErr } = await supabase
        .from('professionals')
        .select('id, display_name, address_id')
        .not('address_id', 'is', null)
        .order('display_name', { ascending: true })

      if (!ignore) {
        if (prosErr) {
          setError((prev) => prev ?? `Impossible de charger les professionnels: ${prosErr.message}`)
          setProfessionals([])
        } else {
          setProfessionals((pros ?? []) as Professional[])
        }
        setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [horseId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || saving) return

    try {
      setSaving(true)
      setError(null)

      // Récup user pour created_by
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const createdBy = userRes.user?.id ?? null

      // Calcule to_address_id : pro.address_id ou création adresse externe
      let toAddressId: string | null = null
      let professionalId: string | null = null

      if (destType === 'professional') {
        professionalId = selectedProId
        const pro = professionals.find((p) => p.id === selectedProId)
        if (!pro?.address_id) {
          throw new Error('Le professionnel sélectionné ne possède pas d’adresse.')
        }
        toAddressId = pro.address_id
      } else {
        // Crée l’adresse externe
        const { data: addrIns, error: addrErr } = await supabase
          .from('addresses')
          .insert({
            label: extAddr.label || null,
            line1: extAddr.line1 || null,
            line2: extAddr.line2 || null,
            postal_code: extAddr.postal_code || null,
            city: extAddr.city || null,
            country: extAddr.country || 'FR',
            created_by: createdBy ?? null,
          })
          .select('id')
          .single()
        if (addrErr) throw addrErr
        toAddressId = addrIns.id
      }

      if (!toAddressId) throw new Error('Adresse de destination manquante.')

      // Convertit datetime-local -> ISO string
      const departIso = departAt ? new Date(departAt).toISOString() : null
      const returnIso = returnAt ? new Date(returnAt).toISOString() : null

      // Insert mouvement
      const { error: mvtErr } = await supabase.from('horse_movements').insert({
        horse_id: horseId,
        from_address_id: fromAddressId, // peut être null si pas de détention connue
        to_address_id: toAddressId,
        start_at: departIso,
        return_at: returnIso,
        reason: reason || null,
        transport,
        professional_id: professionalId,
        manual: true,
        created_by: createdBy,
      })
      if (mvtErr) throw mvtErr

      // Retour fiche cheval
      router.push(`/horses/${horseId}`)
    } catch (err: any) {
      setError(err?.message ?? 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Enregistrer un déplacement</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="px-3 py-1 rounded-xl bg-gray-200 hover:bg-gray-300"
          >
            Annuler
          </button>
          <Link
            href={`/horses/${horseId}`}
            className="px-3 py-1 rounded-xl bg-gray-100 hover:bg-gray-200"
          >
            Fiche cheval
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 bg-white rounded-xl shadow space-y-6">
        {/* Départ (info) */}
        <div>
          <h2 className="font-medium mb-2">Adresse de départ</h2>
          {loading ? (
            <div className="text-gray-500">Chargement…</div>
          ) : fromAddressId ? (
            <p className="text-sm text-gray-700">
              Lieu de détention courant (id: <code className="text-gray-500">{fromAddressId}</code>)
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Aucun lieu de détention courant connu. Le déplacement sera créé sans adresse de départ.
            </p>
          )}
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <h2 className="font-medium">Destination</h2>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="destType"
                value="professional"
                checked={destType === 'professional'}
                onChange={() => setDestType('professional')}
              />
              <span>Chez un professionnel</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="destType"
                value="external"
                checked={destType === 'external'}
                onChange={() => setDestType('external')}
              />
              <span>Adresse externe</span>
            </label>
          </div>

          {destType === 'professional' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Professionnel</label>
              <select
                value={selectedProId}
                onChange={(e) => setSelectedProId(e.target.value)}
                className="w-full rounded-lg border p-2"
                required
              >
                <option value="" disabled>Sélectionner…</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                L’adresse utilisée sera celle du professionnel sélectionné.
              </p>
            </div>
          )}

          {destType === 'external' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Libellé</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.label}
                  onChange={(e) => setExtAddr({ ...extAddr, label: e.target.value })}
                  placeholder="Ex. Clinique équine de Toulouse"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Adresse (ligne 1)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.line1}
                  onChange={(e) => setExtAddr({ ...extAddr, line1: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Adresse (ligne 2)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.line2 ?? ''}
                  onChange={(e) => setExtAddr({ ...extAddr, line2: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Code postal</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.postal_code}
                  onChange={(e) => setExtAddr({ ...extAddr, postal_code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Ville</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.city}
                  onChange={(e) => setExtAddr({ ...extAddr, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Pays</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2"
                  value={extAddr.country}
                  onChange={(e) => setExtAddr({ ...extAddr, country: e.target.value })}
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Informations déplacement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Départ</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border p-2"
              value={departAt}
              onChange={(e) => setDepartAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Retour (optionnel)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border p-2"
              value={returnAt}
              onChange={(e) => setReturnAt(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Motif</label>
            <input
              type="text"
              className="w-full rounded-lg border p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Consultation vétérinaire, concours…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Mode de transport</label>
            <select
              className="w-full rounded-lg border p-2"
              value={transport}
              onChange={(e) => setTransport(e.target.value as any)}
            >
              <option value="unknown">Inconnu</option>
              <option value="van">Van</option>
              <option value="truck">Camion</option>
              <option value="on_foot">À pied</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1 rounded-xl bg-gray-200 hover:bg-gray-300"
            onClick={() => router.back()}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={!canSubmit || saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le déplacement'}
          </button>
        </div>
      </form>
    </div>
  )
}
