let unsaved: () => boolean = () => false

/** The app says here whether an edit is still waiting to be saved. */
export function reportUnsaved(check: () => boolean) {
  unsaved = check
}

function typing(doc: Document): boolean {
  const active = doc.activeElement
  return active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
}

/**
 * Applies a downloaded update, which reloads the page, at the first moment it costs nothing:
 * no edit waiting to be saved and nobody typing in a field. Until then the old version keeps running.
 * Returns a function that gives up waiting.
 */
export function applyUpdateWhenSafe(
  apply: () => void,
  { isUnsaved = () => unsaved(), every = 2000, doc = document }: { isUnsaved?: () => boolean; every?: number; doc?: Document } = {},
): () => void {
  let done = false
  const attempt = () => {
    if (done || isUnsaved()) return
    // A hidden page has nobody typing in it, whatever still has focus.
    if (doc.visibilityState !== 'hidden' && typing(doc)) return
    stop()
    apply()
  }
  const timer = setInterval(attempt, every)
  doc.addEventListener('visibilitychange', attempt)
  const stop = () => {
    done = true
    clearInterval(timer)
    doc.removeEventListener('visibilitychange', attempt)
  }
  queueMicrotask(attempt)
  return stop
}
