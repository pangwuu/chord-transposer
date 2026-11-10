import { useEffect } from 'react'

export type PrototypeVariant = {
  key: string
  name: string
}

/** Throwaway floating bar for UI prototypes. Dev builds only. */
export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: PrototypeVariant[]
  current: string
  onChange: (key: string) => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      event.stopImmediatePropagation()
      const index = Math.max(0, variants.findIndex((item) => item.key === current))
      const next =
        event.key === 'ArrowRight'
          ? variants[(index + 1) % variants.length]
          : variants[(index - 1 + variants.length) % variants.length]
      if (next) onChange(next.key)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [current, onChange, variants])

  const active = variants.find((item) => item.key === current) ?? variants[0]
  if (!active) return null

  const cycle = (delta: number) => {
    const index = Math.max(0, variants.findIndex((item) => item.key === current))
    const next = variants[(index + delta + variants.length) % variants.length]
    if (next) onChange(next.key)
  }

  return (
    <div className="prototype-switcher" role="group" aria-label="Prototype variant">
      <button type="button" aria-label="Previous variant" onClick={() => cycle(-1)}>
        ←
      </button>
      <span className="prototype-switcher-label">
        {active.key} ({active.name})
      </span>
      <button type="button" aria-label="Next variant" onClick={() => cycle(1)}>
        →
      </button>
    </div>
  )
}
