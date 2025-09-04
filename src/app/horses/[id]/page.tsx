'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Horse = {
  id: string
  name: string
  birthdate: string | null
  sex: string | null           // "jument" | "hongre" | "entier" | null
  sire_number: string | null
  photo_url: string | null     // chemin dans le bucket
  created_at: string
}

const BUCKET = 'horse-photos'

export default function HorseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [horse, setHorse] = useState<Horse | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    ;(async () => {
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
      } else {
        const h = data as Horse
        setHorse(h)
        if (h.photo_url) {
          const { data: s } = await supabase
            .storage
            .from(BUCKET)
            .createSignedUrl(h.photo_url, 3600) // 1h
          setSignedUrl(s?.signedUrl ?? null)
        } else {
          setSignedUrl(null)
        }
      }
      setLoading(false)
    })()
    return () => { ignore = true }
  }, [id])

  const sexLabel = (s?: string | null) =>
    s === 'jument' ? 'Jument' : s === 'hongre' ? 'Hongre' : s === 'entier' ? 'Entier' : '—'

  if (loading) return <div>Chargement…</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!horse) return <div>Cheval introuvable</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{horse.name}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/horses/${horse.id}/edit`} className="px-3 py-1 rounded-xl bg-blue-600 text-white">
            Éditer
          </Link>
          <button
            onClick={() => router.back()}
            className="px-3 py-1 rounded-xl bg-gray-200"
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

      <div className="p-4 bg-white rounded-xl shadow space-y-2">
        <p><span className="font-medium">N° SIRE :</span> {horse.sire_number ?? '—'}</p>
        <p><span className="font-medium">Date de naissance :</span> {horse.birthdate ? new Date(horse.birthdate).toLocaleDateString() : '—'}</p>
        <p><span className="font-medium">Sexe :</span> {sexLabel(horse.sex)}</p>
        <p className="text-sm text-gray-500">
          Fiche créée le {new Date(horse.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
