import { formatSymbol } from '../../../domain/chord'
import { padCollisions } from '../../../domain/line-layout'
import type { BarLine, LyricLine, Song } from '../../../domain/song'

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
  const laid = padCollisions(
    line.text,
    line.chords.map((chord) => ({ label: formatSymbol(chord.symbol), index: chord.index })),
  )
  return (
    <div className="play-lyric-block">
      <div className="play-chord-row" aria-hidden={laid.chords.length === 0}>
        {laid.chords.map((chord, index) => (
          <span
            key={`${chord.label}-${chord.index}-${index}`}
            className={chordClass}
            style={{ left: `${chord.index}ch` }}
          >
            {chord.label}
          </span>
        ))}
      </div>
      <p className={lyricClass}>{laid.text}</p>
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
