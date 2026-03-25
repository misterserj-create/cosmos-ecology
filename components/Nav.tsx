"use client"
import { useState, useEffect } from "react"

const links = [
  { href: "#venues", label: "Площадки" },
  { href: "#about", label: "О проекте" },
  { href: "#gallery", label: "Галерея" },
  { href: "#team", label: "Команда" },
  { href: "#partners", label: "Партнёры" },
  { href: "#events", label: "События" },
  { href: "#history", label: "История" },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: "background 0.3s",
        background: scrolled ? "rgba(8,8,8,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(201,168,76,0.15)" : "none",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <a href="#" style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em", color: "#c9a84c", textDecoration: "none", textTransform: "uppercase" }}>
          Экология<br style={{ display: "none" }} /> Космоса
        </a>

        {/* Desktop links */}
        <div style={{ display: "flex", gap: 32 }} className="hidden-mobile">
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaaaaa", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c9a84c")}
              onMouseLeave={e => (e.currentTarget.style.color = "#aaaaaa")}
            >{l.label}</a>
          ))}
        </div>

        {/* Burger */}
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", display: "none", flexDirection: "column", gap: 5, padding: 4 }} className="show-mobile">
          {[0,1,2].map(i => <span key={i} style={{ display: "block", width: 24, height: 1, background: "#c9a84c" }} />)}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: "rgba(8,8,8,0.98)", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: "0.85rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaaaaa", textDecoration: "none" }}>
              {l.label}
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}
