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

    // Было на ScrollTrigger.batch, и на этом сайт наполовину не открывался:
    // при мгновенном прыжке по якорю из меню триггеры не прогонялись, и
    // секции "Команда" и "История" оставались пустыми, в opacity:0. Плюс
    // overwrite:true обрывал недоигравшие твины предыдущей пачки, и часть
    // карточек навсегда зависала полупрозрачной и размытой.
    // IntersectionObserver сообщает состояние сразу при подписке, поэтому
    // после любого прыжка видимые карточки проявляются, а не пропадают.
    // Показ запускается прямо в обработчике, без откладывания на следующий
    // кадр: IntersectionObserver и так отдаёт все совпавшие элементы одной
    // пачкой. Промежуточная очередь на requestAnimationFrame успела побыть
    // в коде ровно одну выкладку и стоила того: элементы снимались с
    // наблюдения сразу, а показ откладывался, и если между этим React
    // пересоздавал эффект, отложенный кадр отменялся - карточки оставались
    // в нуле навсегда. На быстром локальном сервере это не воспроизводилось,
    // на живом сайте воспроизвелось с первого раза.
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
          filter: "blur(0px)",
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
        })
      },
      { rootMargin: "0px 0px -10% 0px" }
    )

    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [children])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
