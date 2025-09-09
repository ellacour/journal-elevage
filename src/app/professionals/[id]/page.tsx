// app/(app)/professionals/[id]/page.tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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

export type Address = {
  id: string
  label: string | null
  line1: string | null
  line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
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

export default function ProfessionalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [pro, setPro] = useState<Professional | null>(null)
  const [addr, setAddr] = useState<Address | null>(null)
  const [horses, setHorses] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError(null)

      // 1) Charger le professionnel
      const { data, error } = await supabase
        .from("professionals")
        .select(
          "id, display_name, company_name, kind, email, phone, website, notes, address_id, is_verified, created_at, created_by"
        )
        .eq("id", id)
        .single()

      if (ignore) return

      if (error) {
        setError(error.message)
        setPro(null)
        setAddr(null)
      } else {
        const p = data as Professional
        setPro(p)

        // 2) Charger l'adresse si présente
        if (p.address_id) {
          const { data: a, error: aerr } = await supabase
            .from("addresses")
            .select("id, label, line1, line2, postal_code, city, country")
            .eq("id", p.address_id)
            .single()
          if (!aerr) setAddr(a as Address)
        } else {
          setAddr(null)
        }

        // 3) Charger les chevaux associés (via RLS => seulement tes chevaux)
        const { data: hp } = await supabase
          .from("horse_professionals")
          .select("horse:horses(id, name)")
          .eq("professional_id", id)

        const hs = (hp as any[])?.map((row) => row.horse).filter(Boolean) as Array<{
          id: string
          name: string
        }>
        setHorses(hs || [])
      }

      setLoading(false)
    })()
    return () => {
      ignore = true
    }
  }, [id])

  const www = useMemo(() => {
    if (!pro?.website) return null
    const hasProto = pro.website.startsWith("http://") || pro.website.startsWith("https://")
    return hasProto ? pro.website : `https://${pro.website}`
  }, [pro?.website])

  if (loading) return <div>Chargement…</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!pro) return <div>Professionnel introuvable</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {pro.display_name}
            {pro.is_verified && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 border">
                Vérifié
              </span>
            )}
          </h1>
          <p className="text-gray-600">
            {pro.company_name ? (
              <>
                <span className="font-medium">{pro.company_name}</span>
                {" · "}
                <span>{KIND_LABEL[pro.kind]}</span>
              </>
            ) : (
              <span>{KIND_LABEL[pro.kind]}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/professionals/${pro.id}/edit`} className="px-3 py-1 rounded-xl bg-blue-600 text-white">
            Éditer
          </Link>
          <button onClick={() => router.back()} className="px-3 py-1 rounded-xl bg-gray-200">
            Retour
          </button>
        </div>
      </div>

      {/* Carte infos */}
      <div className="p-4 bg-white rounded-xl shadow space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p>
              {pro.email ? (
                <a href={`mailto:${pro.email}`} className="text-blue-700 underline">
                  {pro.email}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Téléphone</p>
            <p>
              {pro.phone ? (
                <a href={`tel:${pro.phone.replace(/\s+/g, "")}`} className="text-blue-700 underline">
                  {pro.phone}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Site web</p>
            <p>
              {www ? (
                <a href={www} target="_blank" rel="noreferrer" className="text-blue-700 underline break-all">
                  {pro.website}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Créée le</p>
            <p>{new Date(pro.created_at).toLocaleString()}</p>
          </div>
        </div>

        {addr && (
          <div className="pt-2">
            <p className="text-sm text-gray-500">Adresse</p>
            <p className="whitespace-pre-line">
              {[
                addr.label,
                addr.line1,
                addr.line2,
                [addr.postal_code, addr.city].filter(Boolean).join(" "),
                addr.country,
              ]
                .filter(Boolean)
                .join("\n")}
            </p>
          </div>
        )}

        {pro.notes && (
          <div className="pt-2">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="whitespace-pre-wrap">{pro.notes}</p>
          </div>
        )}
      </div>

      {/* Chevaux associés */}
      <div className="p-4 bg-white rounded-xl shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chevaux associés</h2>
          <Link href={`/professionals`} className="text-sm text-blue-700 underline">
            Voir l'annuaire
          </Link>
        </div>
        {horses.length === 0 ? (
          <p className="text-gray-600">Aucun cheval associé (dans ton périmètre).</p>
        ) : (
          <ul className="divide-y">
            {horses.map((h) => (
              <li key={h.id} className="py-2 flex items-center justify-between">
                <Link href={`/horses/${h.id}`} className="text-blue-700 hover:underline">
                  {h.name}
                </Link>
                <Link
                  href={`/horses/${h.id}`}
                  className="text-sm px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  Ouvrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
