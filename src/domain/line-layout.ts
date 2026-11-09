export type LaidChord = { label: string; index: number }

export function padCollisions(text: string, chords: LaidChord[]): { text: string; chords: LaidChord[]; origins: number[] } {
  const ordered = [...chords].sort((a, b) => a.index - b.index || a.label.localeCompare(b.label))
  let display = text
  let origins = [...text].map((_, index) => index)
  let shift = 0
  const placed: LaidChord[] = []
  for (const chord of ordered) {
    const index = chord.index + shift
    const previous = placed[placed.length - 1]
    const minStart = previous ? previous.index + previous.label.length + 1 : index
    if (index < minStart) {
      const pad = minStart - index
      const left = display[index - 1] ?? ''
      const right = display[index] ?? ''
      const insideWord = index > 0 && index < display.length && /\S/.test(left) && /\S/.test(right)
      const filler = (insideWord ? '-' : ' ').repeat(pad)
      display = display.slice(0, index) + filler + display.slice(index)
      origins = [...origins.slice(0, index), ...Array(pad).fill(-1), ...origins.slice(index)]
      shift += pad
      placed.push({ label: chord.label, index: index + pad })
    } else {
      placed.push({ label: chord.label, index })
    }
  }
  return { text: display, chords: placed, origins }
}
