"use client"
import { useEffect, useRef, useState } from "react"
import gsap from "gsap"

type Comparison = { label: string; value: string }
type Kind = "count" | "millions" | "static"

/** Функции нельзя передавать из серверного компонента в клиентский как пропсы
 *  (RSC serialization) — поэтому формат числа задаётся строковым видом kind,
 *  а не функцией, и форматирование живёт внутри самого компонента.
 *  Разделитель разрядов и дробная часть берутся из локали: 46 250 по-русски,
 *  46,250 по-английски. Слово "млн" приходит из словаря. */
function formatValue(
  kind: Kind,
  n: number,
  intlLocale: string,
  millionsWord: string,
  suffix?: string
): string {
  if (kind === "millions") {
    const value = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n / 1e6)
    return `${value} ${millionsWord}`
  }
  return new Intl.NumberFormat(intlLocale).format(Math.round(n)) + (suffix ?? "")
}

/**
 * Карточка статистики "Акт 02: Плотность". Число наматывается при появлении
 * в кадре, клик по числу переключает на наглядное сравнение (если задано),
 * иконка (i) раскрывает источник — цифры космического мусора без ссылки на
 * первоисточник выглядят как выдумка, а не как факт.
 */
export default function StatTile({
  target,
  kind = "count",
  suffix,
  staticValue,
  label,
  source,
  sourceUrl,
  asOf,
  comparisons = [],
  trend,
  intlLocale,
  labels,
}: {
  target?: number
  kind?: Kind
  suffix?: string
  staticValue?: string
  label: string
  source: string
  sourceUrl: string
  asOf: string
  comparisons?: Comparison[]
  /** Короткая подпись роста — реальное "было" из более старого источника,
   *  не выдуманный секундный прирост. Например: "было ~9 000 т в 2022 (NASA)". */
  trend?: string
  /** Локаль для Intl: "ru-RU", "ja-JP" и так далее. */
  intlLocale: string
  /** Служебные подписи карточки из словаря. */
  labels: { sourceButton: string; asOfPrefix: string; sourceLink: string; millions: string }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState("0")
  const [settled, setSettled] = useState(false)
  const [compareIndex, setCompareIndex] = useState(-1)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const settle = () => {
      if (staticValue !== undefined) setDisplay(staticValue)
      else if (target !== undefined)
        setDisplay(formatValue(kind, target, intlLocale, labels.millions, suffix))
      setSettled(true)
    }

    if (reduced) {
      el.style.opacity = "1"
      el.style.transform = "none"
      el.style.filter = "none"
      settle()
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        gsap.to(el, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out" })
        if (staticValue !== undefined) {
          setDisplay(staticValue)
          setSettled(true)
        } else if (target !== undefined) {
          const counter = { n: 0 }
          gsap.to(counter, {
            n: target,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () =>
              setDisplay(formatValue(kind, counter.n, intlLocale, labels.millions, suffix)),
            onComplete: () => setSettled(true),
          })
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = compareIndex >= 0 ? comparisons[compareIndex] : null

  return (
    <div
      ref={ref}
      className="reveal-item"
      style={{ position: "relative", background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "28px 24px" }}
    >
      <button
        onClick={() => setShowSource(s => !s)}
        aria-label={labels.sourceButton}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid #444",
          color: "#666",
          background: "none",
          cursor: "pointer",
          fontSize: "0.62rem",
          lineHeight: "16px",
          padding: 0,
        }}
      >
        i
      </button>

      <div
        className="tabular-nums"
        onClick={() =>
          settled &&
          comparisons.length > 0 &&
          setCompareIndex(i => (i + 1 >= comparisons.length ? -1 : i + 1))
        }
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--space-accent)",
          fontSize: "1.9rem",
          marginBottom: 8,
          cursor: comparisons.length > 0 ? "pointer" : "default",
        }}
      >
        {active ? active.value : display}
      </div>

      <div style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.03em", lineHeight: 1.5, minHeight: "2.6em" }}>
        {active ? active.label : label}
      </div>

      {trend && !active && (
        <div style={{ color: "var(--entry-accent)", fontSize: "0.72rem", marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
          <span aria-hidden>▲</span>
          {trend}
        </div>
      )}

      {showSource && (
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 10,
            zIndex: 5,
            width: 220,
            background: "#151515",
            border: "1px solid #2a2a2a",
            padding: "12px 14px",
            fontSize: "0.72rem",
            color: "#999",
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: "#c9a84c", marginBottom: 4 }}>{source}</div>
          <div style={{ marginBottom: 6 }}>{labels.asOfPrefix} {asOf}</div>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#8fa7bf" }}>
            {labels.sourceLink}
          </a>
        </div>
      )}
    </div>
  )
}
