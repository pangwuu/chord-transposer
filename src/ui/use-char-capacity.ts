import { useEffect, useRef, useState } from 'react'

/** Advance of one monospace character as a share of font size, the same factor the PDF layout uses. */
const MONO = 0.6

const elementFontSize = (node: HTMLElement) => parseFloat(getComputedStyle(node).fontSize) || 16

/** How many monospace characters fit across the element, or 0 until it has been measured. */
export function useCharCapacity<T extends HTMLElement>(fontSizeOf: (node: T) => number = elementFontSize) {
  const ref = useRef<T>(null)
  const [capacity, setCapacity] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => {
      const style = getComputedStyle(node)
      const inner = node.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      setCapacity(Math.max(0, Math.floor(inner / (fontSizeOf(node) * MONO))))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [fontSizeOf])

  return { ref, capacity }
}
