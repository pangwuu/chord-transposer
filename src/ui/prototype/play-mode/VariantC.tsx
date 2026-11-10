/**
 * Prototype question: What should on-screen chord reading look like?
 * Variant C — Spotlight: one section per screen, oversized type, advance controls.
 */
import { useCallback, useEffect, useState } from 'react'
import { StageBarLine, StageLyricLine, type PlayModeProps } from './shared'

export const variantName = 'Spotlight'

export function VariantC({ songs, onExit }: PlayModeProps) {
  const [songIndex, setSongIndex] = useState(0)
  const [sectionIndex, setSectionIndex] = useState(0)
  const song = songs[Math.min(songIndex, Math.max(0, songs.length - 1))]
  const sectionCount = song?.sections.length ?? 0
  const section = song?.sections[Math.min(sectionIndex, Math.max(0, sectionCount - 1))]

  const advance = useCallback((direction: 1 | -1) => {
    if (!song) return
    setSectionIndex((value) => {
      const next = value + direction
      if (next >= 0 && next < song.sections.length) return next
      if (direction > 0 && songIndex < songs.length - 1) {
        setSongIndex((current) => current + 1)
        return 0
      }
      return value
    })
  }, [song, songIndex, songs.length])

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
    setSectionIndex(0)
  }, [songIndex])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
      // Arrow keys are reserved by the prototype switcher in DEV; Space / Page* still advance.
      if (event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault()
        advance(1)
      }
      if (event.key === 'PageUp') {
        event.preventDefault()
        advance(-1)
      }
      if (!import.meta.env.DEV && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault()
        advance(event.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, onExit])

  if (!song || !section) return null

  return (
    <div
      className="play-c"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        advance(1)
      }}
    >
      <div className="play-c-chrome">
        <button className="text-button" type="button" onClick={onExit}>Exit</button>
        <span className="play-c-progress">
          {section.label} · {sectionIndex + 1}/{song.sections.length}
        </span>
        <span className="grow" />
        <button className="outline" type="button" onClick={() => advance(-1)}>Back</button>
        <button className="outline" type="button" onClick={() => advance(1)}>Next section</button>
        {songs.length > 1 && (
          <button
            className="outline"
            type="button"
            onClick={() => setSongIndex((value) => Math.min(songs.length - 1, value + 1))}
          >
            Next song
          </button>
        )}
      </div>
      <div className="play-c-slide">
        <p className="play-c-song">{song.title}</p>
        <h1 className="play-c-section">{section.label}</h1>
        <div className="play-c-lines">
          {section.lines.map((line) => {
            if (line.type === 'lyric') return <StageLyricLine key={line.id} line={line} chordClass="play-c-chord" lyricClass="play-c-lyric" />
            if (line.type === 'bars') return <StageBarLine key={line.id} line={line} className="play-c-bars" />
            return <p className="play-comment" key={line.id}>{line.text}</p>
          })}
        </div>
      </div>
    </div>
  )
}
