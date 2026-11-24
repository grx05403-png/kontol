import { useLayoutEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function usePageAnimations(scope: RefObject<HTMLElement | null>, pageKey: string) {
  useLayoutEffect(() => {
    const root = scope.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!root || reducedMotion) return

    const context = gsap.context(() => {
      root.querySelectorAll<HTMLElement>('.gsap-title-target').forEach((title) => {
        gsap.fromTo(title.querySelectorAll('.gsap-word'),
          { y: 24, opacity: 0, rotateX: -18 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.65,
            stagger: 0.035,
            ease: 'power3.out',
            clearProps: 'transform',
            scrollTrigger: { trigger: title, start: 'top 92%', once: true },
          },
        )
      })

      root.querySelectorAll<HTMLElement>('.gsap-reveal').forEach((element) => {
        gsap.fromTo(element,
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.62, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 94%', once: true } },
        )
      })
    }, root)

    const frame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => {
      window.cancelAnimationFrame(frame)
      context.revert()
    }
  }, [scope, pageKey])
}
