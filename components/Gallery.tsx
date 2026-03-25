"use client"
import { useState } from "react"
import type { Artwork } from "@/lib/airtable"

const AUTHORS = ["Все", "Сергей Кожуховский", "Елизавета Козырь", "Татьяна Кокорева"]

export default function Gallery({ artworks }: { artworks: Artwork[] }) {
  const [filter, setFilter] = useState("Все")
  const [selected, setSelected] = useState<Artwork | null>(null)

  const filtered = filter === "Все" ? artworks : artworks.filter(a => a.author === filter)

  return (
    <section id="gallery" style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Галерея работ</div>
        <div className="fade-line" style={{ marginBottom: 40 }} />

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 40, flexWrap: "wrap" }}>
          {AUTHORS.map(a => (
            <button key={a} onClick={() => setFilter(a)} style={{
              padding: "8px 20px",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              border: `1px solid ${filter === a ? "#c9a84c" : "#333"}`,
              background: filter === a ? "#c9a84c22" : "transparent",
              color: filter === a ? "#c9a84c" : "#888",
              cursor: "pointer",
              transition: "all 0.2s",
            }}>{a}</button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {filtered.map(art => (
            <div key={art.id} onClick={() => setSelected(art)} style={{ position: "relative", aspectRatio: "1", cursor: "pointer", overflow: "hidden", background: "#111" }}>
              {art.imageUrl ? (
                <img src={art.imageUrl} alt={art.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s", display: "block" }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: "0.8rem" }}>нет фото</div>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 16px 16px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", opacity: 0, transition: "opacity 0.3s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
              >
                <div style={{ fontSize: "0.65rem", color: "#c9a84c", letterSpacing: "0.2em", marginBottom: 4 }}>{art.artId}</div>
                <div style={{ fontFamily: "var(--font-playfair)", fontSize: "1rem", fontWeight: 700 }}>{art.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="lightbox-inner" style={{ maxWidth: 900, width: "100%", background: "#0d0d0d", display: "grid", gridTemplateColumns: "1fr 1fr", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ background: "#111" }}>
              {selected.imageUrl && <img src={selected.imageUrl} alt={selected.title} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "0.65rem", color: "#c9a84c", letterSpacing: "0.3em" }}>{selected.artId}</div>
              <div style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#c9a84c", fontSize: "0.95rem" }}>{selected.author}</div>
              <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.2 }}>{selected.title}</div>
              <div className="fade-line" />
              {selected.technique && <div style={{ fontSize: "0.8rem", color: "#888" }}>{selected.technique}{selected.materials ? ` · ${selected.materials}` : ""}</div>}
              {(selected.size || selected.year) && <div style={{ fontSize: "0.8rem", color: "#666" }}>{selected.size}{selected.year ? ` · ${selected.year}` : ""}</div>}
              {selected.descShort && <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#ccc", marginTop: 8 }}>{selected.descShort}</div>}
              {selected.curatorText && <div style={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.7, marginTop: 8 }}>{selected.curatorText}</div>}
              <button onClick={() => setSelected(null)} style={{ marginTop: "auto", padding: "10px 24px", border: "1px solid #333", background: "none", color: "#888", cursor: "pointer", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
