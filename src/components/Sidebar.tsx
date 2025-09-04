"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu } from "lucide-react" // facultatif: icône; si non installé, remplace par un simple texte

const nav = [
  { href: "/", label: "Accueil" },
  { href: "/horses", label: "Mes chevaux" },
  { href: "/auth", label: "Auth" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Bouton mobile */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed bottom-4 right-4 z-40 rounded-full bg-gray-800 text-white p-3 shadow-lg"
        aria-label="Ouvrir la navigation"
      >
        {/* @ts-ignore */}
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 bg-white border-r shadow-sm transform transition-transform md:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"} md:static`}
      >
        <div className="h-14 flex items-center px-4 border-b font-semibold">
          🐴 Journal d’Élevage
        </div>
        <nav className="p-2 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm
                  ${active ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-800"}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-2 text-xs text-gray-500 mt-auto">
          <p>v0.1 • MVP</p>
        </div>
      </aside>
    </>
  )
}
