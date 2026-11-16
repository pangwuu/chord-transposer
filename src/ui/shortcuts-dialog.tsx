import { useEffect, useRef } from 'react'
import { comboKeys, isApple, SHORTCUT_GROUPS, SHORTCUTS } from './shortcuts'

/** The list of every keyboard shortcut, printed from the same table the key handlers read. */
export function ShortcutsDialog({ onClose, apple = isApple() }: { onClose: () => void; apple?: boolean }) {
  const close = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const closing = useRef(onClose)
  closing.current = onClose

  useEffect(() => {
    const before = document.activeElement
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closing.current()
        return
      }
      if (event.key !== 'Tab') return
      // Focus stays inside the dialog: Tab goes round its controls.
      const stops = [...(dialog.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? [])]
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const inside = dialog.current?.contains(document.activeElement)
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (before instanceof HTMLElement) before.focus()
    }
  }, [])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog shortcuts" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" ref={dialog} onClick={(event) => event.stopPropagation()}>
        <div className="shortcuts-head">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button ref={close} className="outline" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="shortcut-groups">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-label={group}>
              <h3>{group}</h3>
              <dl>
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <div key={shortcut.id} className="shortcut-row">
                    <dt>{shortcut.does}</dt>
                    <dd>
                      {shortcut.combos.map((combo, index) => (
                        <span key={combo} className="shortcut-combo">
                          {index > 0 && <span className="shortcut-or">or</span>}
                          {comboKeys(combo, apple).map((key) => <kbd key={key}>{key}</kbd>)}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
