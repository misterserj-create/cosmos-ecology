"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import type { Artwork } from "@/lib/content"
import { AUTHOR_FILTERS, type AuthorFilter } from "@/lib/site"
import type { Dictionary } from "@/app/(site)/[lang]/dictionaries"

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger)

type GalleryDict = Dictionary["gallery"]

export default function Gallery({ artworks, dict }: { artworks: Artwork[]; dict: GalleryDict }) {
  // Фильтруем по ключу, а не по подписи кнопки. Подпись переводится, поле
  // "автор" в базе - нет, и сравнение переведённой строки с русским полем
  // на любом языке кроме русского просто ничего не находило бы.
  const [filterId, setFilterId] = useState<AuthorFilter["id"]>("all")
  const [selected, setSelected] = useState<Artwork | null>(null)
  // Приближение в просмотре работы. Объекты собраны из сотен мелких деталей,
  // и рассмотреть их вблизи это то единственное, чего не даёт выставочный зал.
  const [zoomed, setZoomed] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setZoomed(false) }, [selected])

  const filtered = useMemo(() => {
    const match = AUTHOR_FILTERS.find(f => f.id === filterId)?.match ?? null
    return match === null ? artworks : artworks.filter(a => a.author === match)
  }, [artworks, filterId])

  // Акт «Алхимия»: работы проступают из темноты, как под лучом в мастерской —
  // та же логика роя, что несёт камеру в акте 02, здесь складывается в форму.
  useEffect(() => {
    if (!gridRef.current) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const cards = gridRef.current.querySelectorAll<HTMLElement>(".art-card")

    if (reduced) {
      cards.forEach(c => {
        c.style.opacity = "1"
        c.style.transform = "none"
        c.style.filter = "none"
      })
      return
    }

    // Тот же случай, что и в Reveal: ScrollTrigger.batch с overwrite:true
    // оставлял часть карточек навсегда размытыми при быстрой прокрутке, а
    // после прыжка по якорю "Галерея" сетка могла не проявиться совсем.
    const observer = new IntersectionObserver(
      entries => {
        const arrived = entries
          .filter(e => e.isIntersecting)
          .map(e => e.target as HTMLElement)
        if (!arrived.length) return
        arrived.forEach(el => observer.unobserve(el))
        gsap.to(arrived, {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
        })
      },
      { rootMargin: "0px 0px -8% 0px" }
    )

    cards.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [filtered])

  // Клавиатурная навигация в лайтбоксе
  useEffect(() => {
    if (!selected) return
    const idx = filtered.findIndex(a => a.id === selected.id)
    function onKey(e: KeyboardEvent) {
      if (idx === -1) return
      if (e.key === "Escape") setSelected(null)
      if (e.key === "ArrowRight") setSelected(filtered[(idx + 1) % filtered.length])
      if (e.key === "ArrowLeft") setSelected(filtered[(idx - 1 + filtered.length) % filtered.length])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, filtered])

  return (
    <section id="gallery" className="grain" style={{ padding: "80px 0", position: "relative", background: "var(--earth-bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>{dict.label}</div>
        <div className="fade-line" style={{ marginBottom: 40 }} />

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 40, flexWrap: "wrap" }}>
          {AUTHOR_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilterId(f.id)} style={{
              padding: "8px 20px",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              border: `1px solid ${filterId === f.id ? "#c9a84c" : "#333"}`,
              background: filterId === f.id ? "#c9a84c22" : "transparent",
              color: filterId === f.id ? "#c9a84c" : "#888",
              cursor: "pointer",
              transition: "all 0.2s",
            }}>{dict.authors[f.id]}</button>
          ))}
        </div>

        {/* Grid */}
        <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {filtered.map(art => (
            <div
              key={art.id}
              className="art-card"
              onClick={() => setSelected(art)}
              style={{
                position: "relative",
                aspectRatio: "1",
                cursor: "pointer",
                overflow: "hidden",
                background: "#111",
                opacity: 0,
                transform: "translateY(32px) scale(0.96)",
                filter: "blur(6px)",
              }}
            >
              {art.imageUrl ? (
                <Image
                  src={art.imageUrl}
                  alt={art.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 50vw, 280px"
                  style={{ objectFit: "cover", transition: "transform 0.5s var(--ease-cinematic)" }}
                  className="art-card-img"
                />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: "0.8rem" }}>{dict.noPhoto}</div>
              )}
              {/*
                Подпись видна всегда. Раньше она появлялась по наведению мыши,
                то есть на телефоне названий работ не было вовсе, а выставка
                без подписей это склад.
              */}
              <div className="art-card-caption" style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "48px 16px 14px", background: "linear-gradient(transparent, rgba(0,0,0,0.9))", pointerEvents: "none" }}>
                <div style={{ fontSize: "0.62rem", color: "#c9a84c", letterSpacing: "0.2em", marginBottom: 4 }}>{art.artId}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>{art.title}</div>
                {art.author && (
                  <div style={{ fontSize: "0.68rem", color: "#9a9a9a", marginTop: 6, letterSpacing: "0.06em" }}>
                    {art.author}{art.year ? `, ${art.year}` : ""}
                  </div>
                )}
              </div>
              <style>{`.art-card:hover .art-card-img { transform: scale(1.05); }`}</style>
            </div>
          ))}
        </div>
      </div>

      {/* Приближение: работа во весь экран, поверх лайтбокса */}
      {selected && zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", overflow: "auto" }}
        >
          {/* Обычный img, а не next/image: здесь нужен родной размер кадра,
              который зритель может увеличить жестом или колесом мыши. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.fullUrl}
            alt={selected.title}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, textAlign: "center", color: "#777", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", pointerEvents: "none" }}>
            {selected.artId} · {selected.title}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            key={selected.id}
            onClick={e => e.stopPropagation()}
            className="lightbox-inner fade-up"
            style={{ maxWidth: 900, width: "100%", background: "#0d0d0d", display: "grid", gridTemplateColumns: "1fr 1fr", maxHeight: "90vh", overflow: "auto" }}
          >
            <div
              onClick={() => setZoomed(true)}
              style={{ background: "#111", position: "relative", aspectRatio: "4 / 3", minWidth: 0, cursor: "zoom-in" }}
            >
              {selected.fullUrl && (
                <Image src={selected.fullUrl} alt={selected.title} fill unoptimized sizes="(max-width: 768px) 100vw, 450px" style={{ objectFit: "contain" }} />
              )}
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <div style={{ fontSize: "0.65rem", color: "#c9a84c", letterSpacing: "0.3em" }}>{selected.artId}</div>
              <div style={{ fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#c9a84c" }}>{selected.author}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.2 }}>{selected.title}</div>
              <div className="fade-line" />
              {selected.technique && <div style={{ fontSize: "0.8rem", color: "#888" }}>{selected.technique}{selected.materials ? ` · ${selected.materials}` : ""}</div>}
              {(selected.size || selected.year) && <div style={{ fontSize: "0.8rem", color: "#666" }}>{selected.size}{selected.year ? ` · ${selected.year}` : ""}</div>}
              <button
                onClick={() => setZoomed(true)}
                style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "none", color: "#c9a84c", fontSize: "0.68rem", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", borderBottom: "1px solid #4a3d18", paddingBottom: 3 }}
              >
                {dict.zoomHint}
              </button>
              {selected.descShort && <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#ccc", marginTop: 8 }}>{selected.descShort}</div>}
              {selected.curatorText && <div style={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.7, marginTop: 8 }}>{selected.curatorText}</div>}
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "0.68rem", color: "#555", letterSpacing: "0.1em" }}>{dict.arrowsHint}</span>
                <button onClick={() => setSelected(null)} style={{ padding: "10px 24px", border: "1px solid #333", background: "none", color: "#888", cursor: "pointer", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  {dict.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
