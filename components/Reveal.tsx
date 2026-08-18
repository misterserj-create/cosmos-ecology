"use client"
import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger)

/**
 * Каскадное появление карточек при скролле — общий приём для секций
 * "Земли" (Площадки, Команда, Партнёры, События, История, Благодарности).
 * Дети с классом .reveal-item стартуют скрытыми (globals.css) и проявляются
 * пачками через ScrollTrigger.batch, а не через IntersectionObserver на
 * каждый элемент — дешевле при большом числе карточек.
 */
export default function Reveal({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const items = ref.current.querySelectorAll<HTMLElement>(".reveal-item")

    if (reduced) {
      items.forEach(el => {
        el.style.opacity = "1"
        el.style.transform = "none"
        el.style.filter = "none"
      })
      return
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.batch(items, {
        start: "top 90%",
        onEnter: batch =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.08,
            overwrite: true,
          }),
      })
    }, ref)
    return () => ctx.revert()
  }, [children])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
