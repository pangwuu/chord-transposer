import { useEffect, useRef, useState } from 'react'
import { formatSymbol } from '../../../domain/chord'
import { padCollisions, wrapLyricDisplay } from '../../../domain/line-layout'
import type { BarLine, LyricLine, Song } from '../../../domain/song'

/** Same advance factor PDF layout uses for mono capacity. */
const MONO = 0.6

export type PlayModeProps = {
  songs: Song[]
  onExit: () => void
}

export function StageLyricLine({
  line,
  chordClass = 'play-chord',
  lyricClass = 'play-lyric',
}: {
  line: LyricLine
  chordClass?: string
  lyricClass?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => {
      const fontSize = parseFloat(getComputedStyle(node).fontSize) || 16
      setCapacity(Math.max(0, Math.floor(node.clientWidth / (fontSize * MONO))))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const laid = padCollisions(
    line.text,
    line.chords.map((chord) => ({ label: formatSymbol(chord.symbol), index: chord.index })),
  )
  const segments = capacity > 0
    ? wrapLyricDisplay(laid.text, laid.chords, capacity)
    : [{ text: laid.text, chords: laid.chords }]

  return (
    <div className="play-lyric-wrap" ref={ref}>
      {segments.map((segment, segmentIndex) => (
        <div className="play-lyric-block" key={`${line.id}-${segmentIndex}-${segment.text}`}>
          <div className="play-chord-row" aria-hidden={segment.chords.length === 0}>
            {segment.chords.map((chord, index) => (
              <span
                key={`${chord.label}-${chord.index}-${index}`}
                className={chordClass}
                style={{ left: `${chord.index}ch` }}
              >
                {chord.label}
              </span>
            ))}
          </div>
          <p className={lyricClass}>{segment.text}</p>
        </div>
      ))}
    </div>
  )
}

export function StageBarLine({ line, className = 'play-bars' }: { line: BarLine; className?: string }) {
  const text = line.items
    .map((item) => {
      if (item.kind === 'chord') return formatSymbol(item.symbol)
      if (item.kind === 'rest') return item.mark
      return '|'
    })
    .join(' ')
  return <p className={className}>{text}</p>
}
