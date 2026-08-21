"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import type { DescentProgress } from "./DebrisField"

const DebrisField = dynamic(() => import("./DebrisField"), { ssr: false })

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Сквозная сцена "космос → Земля": держит канвас фиксированным на весь
 * вьюпорт, пока пользователь скроллит сквозь Hero/Площадки/О проекте,
 * и гонит прогресс 0..1 в WebGL-сцену через ref (без ре-рендеров React).
 * Отключается по prefers-reduced-motion и на узких экранах — остаётся
 * только статичный радиальный градиент, который уже был в Hero.
 */
export default function CosmicDescent({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const washRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const progress = useRef<DescentProgress>({ current: 0 })
  const [canRenderScene, setCanRenderScene] = useState(false)
  const [lite, setLite] = useState(false)
  const [inView, setInView] = useState(false)
  const [sceneKey, setSceneKey] = useState(0)
  const contextLossCount = useRef(0)

  const liteRef = useRef(false)

  function handleContextLost() {
    contextLossCount.current += 1
    // На мобильной (lite) сцене повторные попытки пересоздать контекст на и
    // так слабом GPU обычно приводят к тому же краху — раньше это выглядело
    // как "мигнуло и почернело". Сразу и окончательно уходим на статичный
    // градиент, без попытки реанимации. На десктопе даём одну попытку.
    if (liteRef.current || contextLossCount.current > 1) {
      setCanRenderScene(false)
      return
    }
    setTimeout(() => setSceneKey(k => k + 1), 300)
  }

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Ширина экрана одна не ловит все телефоны/планшеты (часть Android-
    // устройств шире 560px), поэтому дополнительно смотрим на тип указателя и UA.
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const isMobile = isCoarsePointer || isMobileUA || window.innerWidth < 900
    setCanRenderScene(!reduced)
    setLite(isMobile)
    liteRef.current = isMobile
  }, [])

  useEffect(() => {
    if (!wrapperRef.current || !canRenderScene) return
    // Дебаунс: на первой отрисовке страницы (шрифты/картинки меняют раскладку)
    // IntersectionObserver может дёрнуть isIntersecting несколько раз подряд —
    // без задержки это пересоздаёт WebGL-канвас за доли секунды и Chrome теряет
    // контекст ("Context Lost"). Применяем только состояние, которое продержалось.
    let timeoutId: ReturnType<typeof setTimeout>
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => setInView(entry.isIntersecting), 200)
      },
      { rootMargin: "20% 0px -15% 0px" }
    )
    observer.observe(wrapperRef.current)
    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [canRenderScene])

  useEffect(() => {
    if (!wrapperRef.current || !canRenderScene) return
    const trigger = ScrollTrigger.create({
      trigger: wrapperRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => {
        progress.current.current = self.progress
        if (washRef.current) {
          washRef.current.style.opacity = String(
            self.progress < 0.55 ? 0 : Math.min((self.progress - 0.55) / 0.25, 1) * 0.18
          )
        }
        // Камера теперь идёт вплотную к Земле, и освещённая поверхность
        // занимает почти весь кадр — текст разделов поверх неё не читался.
        // Затемняем сцену по мере спуска: к середине прокрутки она уходит
        // в фон, как затемнение в кино перед следующей сценой.
        if (scrimRef.current) {
          scrimRef.current.style.opacity = String(
            Math.min(Math.max((self.progress - 0.12) / 0.33, 0), 1) * 0.72
          )
        }
      },
      onLeave: () => {
        if (washRef.current) washRef.current.style.opacity = "0"
      },
    })
    return () => trigger.kill()
  }, [canRenderScene])

  return (
    <div ref={wrapperRef} data-cosmic-descent style={{ position: "relative" }} className="grain">
      {canRenderScene && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s var(--ease-cinematic)",
          }}
        >
          {inView && (
            <DebrisField
              key={sceneKey}
              progress={progress.current}
              lite={lite}
              onContextLost={handleContextLost}
            />
          )}
          {/* На узком экране планета занимает почти весь кадр, и подзаголовок
              с кнопкой ложатся на освещённую поверхность. Притемняем низ
              кадра - только на телефонах, на широком экране низ и так чёрный. */}
          <div className="hero-scrim" aria-hidden />
          <div
            ref={washRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--entry-accent)",
              mixBlendMode: "overlay",
              opacity: 0,
            }}
          />
          <div
            ref={scrimRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg)",
              opacity: 0,
            }}
          />
        </div>
      )}
      {!canRenderScene && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, #1a1200 0%, var(--space-bg) 60%, var(--bg) 100%)",
          }}
        />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  )
}
