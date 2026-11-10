/**
 * Prototype question: What should on-screen chord reading look like?
 * Variant A — Quiet Chart: continuous scroll, warm chords, auto-hiding chrome.
 */
import { useEffect, useRef, useState } from 'react'
import { formatKey } from '../../../domain/chord'
import { StageBarLine, StageLyricLine, type PlayModeProps } from './shared'

export const variantName = 'Quiet Chart'
const CHROME_IDLE_MS = 2600

export function VariantA({ songs, onExit }: PlayModeProps) {
  const [section, setSection] = useState(0)
  const [songIndex, setSongIndex] = useState(0)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [stickyLabel, setStickyLabel] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number>()
  const song = songs[Math.min(songIndex, Math.max(0, songs.length - 1))]

  const revealChrome = () => {
    setChromeVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS)
  }

  useEffect(() => {
    revealChrome()
    return () => window.clearTimeout(hideTimer.current)
  }, [songIndex])

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
      revealChrome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  useEffect(() => {
    const root = body.current
    if (!root || !song) return
    setStickyLabel(song.sections[0]?.label ?? '')
    if (typeof IntersectionObserver === 'undefined') return
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-stage-section]')]
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const label = visible?.target.getAttribute('data-stage-section')
        if (label) setStickyLabel(label)
      },
      { root, threshold: [0.35, 0.6, 0.85] },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [song])

  if (!song) return null

  const goSection = (direction: 1 | -1) => {
    setSection((value) => {
      const next = Math.min(song.sections.length - 1, Math.max(0, value + direction))
      body.current?.querySelector(`[data-stage-section-index="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return next
    })
    revealChrome()
  }

  return (
    <div className="play-a" onPointerDown={revealChrome} onMouseMove={revealChrome}>
      <div className={chromeVisible ? 'play-a-chrome' : 'play-a-chrome is-hidden'} aria-hidden={!chromeVisible}>
        <button className="text-button" type="button" onClick={onExit}>Exit</button>
        <span className="play-a-key">{formatKey(song.originalKey)}</span>
        <span className="grow" />
        <button className="outline" type="button" onClick={() => goSection(1)}>Next section</button>
        {songs.length > 1 && (
          <button
            className="outline"
            type="button"
            onClick={() => {
              setSongIndex((value) => Math.min(songs.length - 1, value + 1))
              setSection(0)
              body.current?.scrollTo({ top: 0 })
              revealChrome()
            }}
          >
            Next song
          </button>
        )}
      </div>
      <div className="play-a-body" ref={body} onScroll={revealChrome}>
        {stickyLabel && <p className="play-a-sticky" aria-live="polite">{stickyLabel}</p>}
        <header className="play-a-head">
          <strong className="play-a-title">{song.title}</strong>
          {song.artist && <p className="play-a-artist">{song.artist}</p>}
        </header>
        {song.sections.map((item, index) => (
          <section
            key={item.id}
            className={index === section ? 'play-a-section is-current' : 'play-a-section'}
            data-stage-section={item.label}
            data-stage-section-index={index}
          >
            <h2 className="play-a-section-label">{item.label}</h2>
            {item.lines.map((line) => {
              if (line.type === 'lyric') return <StageLyricLine key={line.id} line={line} chordClass="play-a-chord" lyricClass="play-a-lyric" />
              if (line.type === 'bars') return <StageBarLine key={line.id} line={line} className="play-a-bars" />
              return <p className="play-comment" key={line.id}>{line.text}</p>
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
