import type { Dictionary } from "@/app/(site)/[lang]/dictionaries"

/**
 * Подвал сайта. Вынесен из главной, когда появились страницы журнала:
 * один и тот же подвал на всех страницах, правится в одном месте.
 */
export default function SiteFooter({ dict }: { dict: Dictionary["footer"] }) {
  return (
    <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <span style={{ fontFamily: "var(--font-display)", color: "#c9a84c", fontSize: "0.9rem" }}>{dict.brand}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span style={{ color: "#5a5a5a", fontSize: "0.75rem" }}>{dict.cities}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.75rem" }}>
            <a href="https://xn--80afpgcdklbdb8ac0nmb.xn--p1ai" style={{ color: "#8a8a8a", textDecoration: "none" }}>
              экологиякосмоса.рф
            </a>
            <span style={{ color: "#3a3a3a" }}>·</span>
            <a href="https://cosmosecology.ru" style={{ color: "#8a8a8a", textDecoration: "none" }}>
              cosmosecology.ru
            </a>
          </span>
          <a href="https://notevibe.ru" target="_blank" rel="noopener" style={{ color: "#333", fontSize: "0.75rem", textDecoration: "none" }}>
            {dict.credit}
          </a>
        </div>
      </div>
    </footer>
  )
}
