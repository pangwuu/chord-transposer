import { useEffect, useRef, useState } from 'react'
import type { Key } from '../domain/chord'
import { padCollisions, wrapLyricDisplay } from '../domain/line-layout'
import type { BarLine, LyricLine } from '../domain/song'
import { symbolLabel } from './chart'

/** Same advance factor PDF layout uses for mono capacity. */
const MONO = 0.6

export function StageLyricLine({
  line,
  numbers,
  shapeKey,
}: {
  line: LyricLine
  numbers: boolean
  shapeKey: Key
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
    line.chords.map((chord) => ({
      label: symbolLabel(chord.symbol, numbers, shapeKey),
      index: chord.index,
    })),
  )
  const segments = capacity > 0
    ? wrapLyricDisplay(laid.text, laid.chords, capacity)
    : [{ text: laid.text, chords: laid.chords }]

  return (
    <div className="stage-lyric-wrap" ref={ref}>
      {segments.map((segment, segmentIndex) => (
        <div className="stage-lyric-block" key={`${line.id}-${segmentIndex}-${segment.text}`}>
          <div className="stage-chord-row" aria-hidden={segment.chords.length === 0}>
            {segment.chords.map((chord, index) => (
              <span
                key={`${chord.label}-${chord.index}-${index}`}
                className="stage-chord"
                style={{ left: `${chord.index}ch` }}
              >
                {chord.label}
              </span>
            ))}
          </div>
          <p className="stage-lyric">{segment.text}</p>
        </div>
      ))}
    </div>
  )
}

export function StageBarLine({
  line,
  numbers,
  shapeKey,
}: {
  line: BarLine
  numbers: boolean
  shapeKey: Key
}) {
  const text = line.items
    .map((item) => {
      if (item.kind === 'chord') return symbolLabel(item.symbol, numbers, shapeKey)
      if (item.kind === 'rest') return item.mark
      return '|'
    })
    .join(' ')
  return <p className="stage-bars">{text}</p>
}
