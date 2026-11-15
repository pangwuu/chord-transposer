import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

const KEY_STEP = 16

/**
 * The draggable edge of a desktop pane. Drag it or use the arrow keys to resize; double-click to reset.
 * `edge` is the side of the pane the divider sits on: dragging away from the pane widens it.
 * Without `width`, the pane is the divider's parent and is measured when a drag starts.
 */
export function PaneDivider({ label, edge, width, className = '', onResize, onReset }: {
  label: string
  edge: 'left' | 'right'
  width?: number
  className?: string
  onResize: (width: number) => void
  onReset: () => void
}) {
  const drag = useRef<{ x: number; width: number } | null>(null)
  const outward = edge === 'right' ? 1 : -1
  const current = (handle: HTMLElement) => width ?? handle.parentElement?.getBoundingClientRect().width ?? 0

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, width: current(event.currentTarget) }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current) onResize(drag.current.width + (event.clientX - drag.current.x) * outward)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    onResize(current(event.currentTarget) + (event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP) * outward)
  }

  return (
    <div
      className={`pane-divider on-${edge} ${className}`.trim()}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      title="Drag to resize. Double-click to reset."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => { drag.current = null }}
      onPointerCancel={() => { drag.current = null }}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  )
}
