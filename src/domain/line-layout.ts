export type LaidChord = { label: string; index: number }

export type LyricDisplaySegment<T extends LaidChord = LaidChord> = { text: string; chords: T[]; origins?: number[] }

export function padCollisions(text: string, chords: LaidChord[]): { text: string; chords: LaidChord[]; origins: number[] } {
  const ordered = [...chords].sort((a, b) => a.index - b.index)
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

/** Wrap a display lyric (after padCollisions) to a character capacity. Matches PDF wrapBlock rules. */
export function wrapLyricDisplay<T extends LaidChord>(text: string, chords: T[], capacity: number, origins?: number[]): LyricDisplaySegment<T>[] {
  const segment = (part: { text: string; chords: T[] }, from: number, to: number, indent: number): LyricDisplaySegment<T> =>
    origins ? { ...part, origins: [...Array(indent).fill(-1), ...origins.slice(from, to)] } : part
  if (capacity < 8 || text.length <= capacity) return [segment({ text, chords }, 0, text.length, 0)]
  const lines: LyricDisplaySegment<T>[] = []
  let remaining = text
  let placed = chords
  let consumed = 0
  let first = true
  while (remaining.length > 0) {
    const width = first ? capacity : Math.max(1, capacity - 2)
    let cut = remaining.length
    if (remaining.length > width) {
      const space = remaining.lastIndexOf(' ', width)
      cut = space > 0 ? space : width
    }
    const head = remaining.slice(0, cut)
    let next = cut
    while (remaining[next] === ' ') next += 1
    const indent = first ? 0 : 2
    const last = next >= remaining.length
    lines.push(
      segment(
        {
          text: first ? head : `  ${head}`,
          chords: placed.filter((chord) => last || chord.index < cut).map((chord) => ({ ...chord, index: chord.index + indent })),
        },
        consumed,
        consumed + cut,
        indent,
      ),
    )
    placed = placed
      .filter((chord) => chord.index >= cut)
      .map((chord) => ({
        ...chord,
        index: Math.max(0, chord.index - next),
      }))
    if (next >= remaining.length) break
    consumed += next
    remaining = remaining.slice(next)
    first = false
  }
  return lines
}
