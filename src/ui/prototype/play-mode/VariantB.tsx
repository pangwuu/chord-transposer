/**
 * Prototype question: What should on-screen chord reading look like?
 * Variant B — Focus Column: narrow centered chart + section jump rail.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { formatKey } from '../../../domain/chord'
import { StageBarLine, StageLyricLine, type PlayModeProps } from './shared'

export const variantName = 'Focus Column'

export function VariantB({ songs, onExit }: PlayModeProps) {
  const [songIndex, setSongIndex] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  const song = songs[Math.min(songIndex, Math.max(0, songs.length - 1))]

  useEffect(() => {
    let released = false
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then((sentinel) => {
      if (released) void sentinel.release()
      else lock = sentinel
    }).catch(() => {})
    return () => {
      released = true
      void lock?.release()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  useEffect(() => {
    setActiveSection(0)
    body.current?.scrollTo({ top: 0 })
  }, [songIndex])

  if (!song) return null

  const jumpTo = (index: number) => {
    setActiveSection(index)
    body.current?.querySelector(`[data-play-b-section="${index}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - bounds.top
    if (y > bounds.height * 0.66) jumpTo(Math.min(song.sections.length - 1, activeSection + 1))
    else if (y < bounds.height * 0.33) jumpTo(Math.max(0, activeSection - 1))
  }

  return (
    <div className="play-b">
      <header className="play-b-top">
        <button className="text-button" type="button" onClick={onExit}>Exit</button>
        <div className="play-b-meta">
          <strong>{song.title}</strong>
          <span>{formatKey(song.originalKey)}</span>
        </div>
        <button className="outline" type="button" onClick={() => jumpTo(Math.min(song.sections.length - 1, activeSection + 1))}>
          Next section
        </button>
        {songs.length > 1 && (
          <button
            className="outline"
            type="button"
            onClick={() => setSongIndex((value) => Math.min(songs.length - 1, value + 1))}
          >
            Next song
          </button>
        )}
      </header>
      <div className="play-b-layout">
        <nav className="play-b-rail" aria-label="Sections">
          {song.sections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === activeSection ? 'is-active' : undefined}
              onClick={() => jumpTo(index)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="play-b-column" ref={body} onClick={onBodyClick}>
          {song.artist && <p className="play-b-artist">{song.artist}</p>}
          {song.sections.map((item, index) => (
            <section
              key={item.id}
              className="play-b-section"
              data-play-b-section={index}
              style={{ opacity: index === activeSection ? 1 : 0.55 }}
            >
              <h2>{item.label}</h2>
              {item.lines.map((line) => {
                if (line.type === 'lyric') return <StageLyricLine key={line.id} line={line} chordClass="play-b-chord" lyricClass="play-b-lyric" />
                if (line.type === 'bars') return <StageBarLine key={line.id} line={line} className="play-b-bars" />
                return <p className="play-comment" key={line.id}>{line.text}</p>
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
