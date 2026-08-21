"use client"

import { useState } from "react"
import gsap from "gsap"
import { ScrollToPlugin } from "gsap/ScrollToPlugin"

if (typeof window !== "undefined") gsap.registerPlugin(ScrollToPlugin)

/**
 * Отдельный вход в сцену "спуска": по клику плавно доскролливает до точки
 * максимального приближения к Земле внутри CosmicDescent — не отдельный
 * экран/состояние, а управляемый прыжок по той же самой шкале прогресса.
 */
export default function DiveButton({ label }: { label: string }) {
  const [hover, setHover] = useState(false)

  function handleClick() {
    const wrapper = document.querySelector<HTMLElement>("[data-cosmic-descent]")
    if (!wrapper) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const rect = wrapper.getBoundingClientRect()
    const targetY = window.scrollY + rect.top + rect.height * 0.92

    if (reduced) {
      window.scrollTo({ top: targetY })
      return
    }
    gsap.to(window, {
      duration: 2.2,
      scrollTo: { y: targetY, autoKill: true },
      ease: "power2.inOut",
    })
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: hover ? "var(--space-accent)" : "#777",
        fontSize: "0.75rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        marginTop: 20,
        transition: "color 0.3s var(--ease-cinematic)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
      <span style={{ transform: hover ? "translateY(3px)" : "translateY(0)", transition: "transform 0.3s var(--ease-cinematic)" }}>↓</span>
    </button>
  )
}
