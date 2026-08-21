"use client"
import { useState, useEffect, useRef } from "react"
import { localeNames, localePath, localeShort, locales, type Locale } from "@/i18n/config"
import type { Dictionary } from "@/app/(site)/[lang]/dictionaries"

type NavDict = Dictionary["nav"]

// Раздел событий на странице показывается только когда события есть.
// Пункт меню, ведущий в никуда, - верный признак брошенного сайта.
export default function Nav({
  dict,
  locale,
  hasEvents = true,
}: {
  dict: NavDict
  locale: Locale
  hasEvents?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const allLinks = [
    { href: "#venues", label: dict.links.venues },
    { href: "#about", label: dict.links.about },
    { href: "#gallery", label: dict.links.gallery },
    { href: "#team", label: dict.links.team },
    { href: "#partners", label: dict.links.partners },
    { href: "#events", label: dict.links.events },
    { href: "#history", label: dict.links.history },
  ]
  const links = hasEvents ? allLinks : allLinks.filter(l => l.href !== "#events")

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Список языков закрывается по клику мимо и по Escape - иначе он остаётся
  // висеть поверх сцены, когда человек передумал.
  useEffect(() => {
    if (!langOpen) return
    function onDown(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLangOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [langOpen])

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
        <a href={localePath(locale)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em", color: "#c9a84c", textDecoration: "none", textTransform: "uppercase" }}>
          {dict.brand}
        </a>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden-mobile">
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaaaaa", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c9a84c")}
              onMouseLeave={e => (e.currentTarget.style.color = "#aaaaaa")}
            >{l.label}</a>
          ))}

          {/* Переключатель языков */}
          <div ref={langRef} style={{ position: "relative" }}>
            <button
              onClick={() => setLangOpen(v => !v)}
              aria-label={dict.language}
              aria-expanded={langOpen}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                background: "none",
                border: `1px solid ${langOpen ? "#c9a84c" : "rgba(201,168,76,0.28)"}`,
                color: langOpen ? "#c9a84c" : "#aaaaaa",
                cursor: "pointer",
                fontSize: "0.7rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                transition: "color 0.2s, border-color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c9a84c")}
              onMouseLeave={e => (e.currentTarget.style.color = langOpen ? "#c9a84c" : "#aaaaaa")}
            >
              {localeShort[locale]}
              <span aria-hidden style={{ fontSize: "0.55rem", transform: langOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
            </button>

            {langOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  minWidth: 170,
                  background: "#080808",
                  border: "1px solid rgba(201,168,76,0.22)",
                  padding: "6px 0",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {locales.map(l => (
                  <a
                    key={l}
                    href={localePath(l)}
                    hrefLang={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      padding: "9px 16px",
                      fontSize: "0.75rem",
                      letterSpacing: "0.08em",
                      textDecoration: "none",
                      color: l === locale ? "#c9a84c" : "#8a8a8a",
                      transition: "color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = "#c9a84c"
                      e.currentTarget.style.background = "rgba(201,168,76,0.07)"
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = l === locale ? "#c9a84c" : "#8a8a8a"
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <span>{localeNames[l]}</span>
                    <span style={{ fontSize: "0.62rem", letterSpacing: "0.22em", color: "#555" }}>{localeShort[l]}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Burger */}
        <button onClick={() => setOpen(!open)} aria-label={dict.menu} style={{ background: "none", border: "none", cursor: "pointer", display: "none", flexDirection: "column", gap: 5, padding: 4 }} className="show-mobile">
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

          <div style={{ borderTop: "1px solid rgba(201,168,76,0.18)", paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "#555", marginBottom: 12 }}>{dict.language}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {locales.map(l => (
                <a
                  key={l}
                  href={localePath(l)}
                  hrefLang={l}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.68rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    border: `1px solid ${l === locale ? "#c9a84c" : "#2a2a2a"}`,
                    color: l === locale ? "#c9a84c" : "#8a8a8a",
                  }}
                >
                  {localeShort[l]}
                </a>
              ))}
            </div>
          </div>
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
