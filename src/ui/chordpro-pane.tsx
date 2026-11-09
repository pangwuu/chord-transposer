import { useEffect, useState } from 'react'
import { toChordPro } from '../domain/chordpro'
import type { Song } from '../domain/song'

export function ChordProPane({ song, onApply }: { song: Song; onApply: (text: string) => void }) {
  const [text, setText] = useState(() => toChordPro(song))
  useEffect(() => setText(toChordPro(song)), [song])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (text !== toChordPro(song)) onApply(text)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [text, song, onApply])
  return <textarea className="source chordpro" aria-label="ChordPro source" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
}
