"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type Horse = {
  id: string
  owner_id: string
  name: string
  sire_number: string | null
  birthdate: string | null
  sex: string | null
  photo_url: string | null       // <-- chemin dans le bucket
  created_at: string
}

const BUCKET = "horse-photos"

export default function EditHorsePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [horse, setHorse] = useState<Horse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form
  const [name, setName] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [sex, setSex] = useState("")
  const [sireNumber, setSireNumber] = useState("")
  const [photoPath, setPhotoPath] = useState<string | null>(null) // chemin dans le bucket
  const [signedUrl, setSignedUrl] = useState<string | null>(null) // URL signée (preview)
  const [file, setFile] = useState<File | null>(null)

  // simple taille/format check
  const fileError = useMemo(() => {
    if (!file) return null
    const okType = file.type.startsWith("image/")
    const okSize = file.size <= 5 * 1024 * 1024 // 5MB
    if (!okType) return "Le fichier doit être une image."
    if (!okSize) return "Image trop lourde (max 5 Mo)."
    return null
  }, [file])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true); setError(null)

      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) { if (!ignore) setError(uerr.message); setLoading(false); return }
      if (!user) { if (!ignore) setLoading(false); return }
      setUserId(user.id)

      const { data, error } = await supabase
        .from("horses")
        .select("id,owner_id,name,sire_number,birthdate,sex,photo_url,created_at")
        .eq("id", id)
        .single()

      if (!ignore) {
        if (error) setError(error.message)
        else if (data) {
          const h = data as Horse
          setHorse(h)
          setName(h.name ?? "")
          setBirthdate(h.birthdate ?? "")
          setSex(h.sex ?? "")
          setSireNumber(h.sire_number ?? "")
          setPhotoPath(h.photo_url ?? null)
          // Génère une URL signée si une photo existe
          if (h.photo_url) {
            const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(h.photo_url, 3600)
            setSignedUrl(s?.signedUrl ?? null)
          }
        }
        setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [id])

  async function uploadIfNeeded(): Promise<string | null> {
    if (!file || !userId || !horse) return null
    // chemin propre et stable
    const filename = file.name.replace(/\s+/g, "_")
    const path = `${userId}/${horse.id}/${Date.now()}_${filename}`

    const { error: upErr } = await supabase
      .storage
      .from(BUCKET)
      .upload(path, file, { upsert: true })

    if (upErr) { setError(upErr.message); return null }
    return path
  }

  async function refreshSignedUrl(path: string | null) {
    if (!path) { setSignedUrl(null); return }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    setSignedUrl(data?.signedUrl ?? null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return setError("Veuillez vous connecter.")
    if (!horse) return
    if (!name.trim()) return setError("Le nom est obligatoire.")
    if (fileError) return setError(fileError)

    setSaving(true); setError(null)

    // 1) upload si un nouveau fichier est choisi
    let newPath: string | null = null
    if (file) {
      newPath = await uploadIfNeeded()
      if (!newPath) { setSaving(false); return }
    }

    // 2) mettre à jour la table (utilise le nouveau chemin si upload, sinon garde l'existant)
    const payload: Partial<Horse> = {
      name: name.trim(),
      birthdate: birthdate || null,
      sex: sex || null,
      sire_number: sireNumber || null,
      photo_url: (newPath ?? photoPath) || null,
    }

    const { error } = await supabase
      .from("horses")
      .update(payload)
      .eq("id", horse.id)
      .eq("owner_id", userId) // garde supplémentaire au-delà du RLS

    setSaving(false)
    if (error) return setError(error.message)

    // 3) on rafraîchit l’URL signée si on reste sur la page,
    //    ou on repart sur la fiche (meilleur flow)
    router.push(`/horses/${horse.id}`)
  }

  if (loading) return <div className="min-h-screen p-6">Chargement…</div>

  if (!userId)
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Éditer le cheval</h1>
        <p className="text-gray-600 mb-4">Vous devez être connecté.</p>
        <Link href="/auth" className="text-blue-600 underline">Se connecter</Link>
      </div>
    )

  if (!horse)
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Cheval introuvable</h1>
        <Link href="/horses" className="text-blue-600 underline">← Retour à la liste</Link>
      </div>
    )

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Éditer : {horse.name}</h1>
        <Link href={`/horses/${horse.id}`} className="text-sm text-blue-600 hover:underline">
          ← Retour à la fiche
        </Link>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              value={birthdate ?? ""}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sexe</label>
            <select
              className="w-full p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sex ?? ""}
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
            value={sireNumber ?? ""}
            onChange={(e) => setSireNumber(e.target.value)}
            placeholder="250001234567890"
          />
        </div>

        {/* PHOTO */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Photo</label>
          {signedUrl && (
            <img
              src={signedUrl}
              alt={name || "Cheval"}
              className="h-40 w-full object-cover rounded-lg border"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              setFile(f)
              // preview immédiat côté client
              if (f) setSignedUrl(URL.createObjectURL(f))
              if (!f) refreshSignedUrl(photoPath)
            }}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {fileError && <p className="text-xs text-red-600">{fileError}</p>}
        </div>

        <div className="text-xs text-gray-500">
          Créé le {new Date(horse.created_at).toLocaleString()}
        </div>

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
