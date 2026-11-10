import { useEffect, useRef, useState } from 'react'
import { formatKey } from '../domain/chord'
import type { Song } from '../domain/song'
import { StageBarLine, StageLyricLine } from './stage-lines'

const CHROME_IDLE_MS = 2600

/** Full-screen Quiet Chart reading view — no edit or tempo chrome. */
export function StageView({ songs, onExit }: { songs: Song[]; onExit: () => void }) {
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
    <div className="stage" onPointerDown={revealChrome} onMouseMove={revealChrome}>
      <div className={chromeVisible ? 'stage-chrome' : 'stage-chrome is-hidden'} aria-hidden={!chromeVisible}>
        <button className="text-button" type="button" onClick={onExit}>Exit</button>
        <span className="stage-key">{formatKey(song.originalKey)}</span>
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
      <div className="stage-body" ref={body} onScroll={revealChrome}>
        {stickyLabel && <p className="stage-sticky" aria-live="polite">{stickyLabel}</p>}
        <header className="stage-head">
          <strong className="stage-title">{song.title}</strong>
          {song.artist && <p className="stage-artist">{song.artist}</p>}
        </header>
        {song.sections.map((item, index) => (
          <section
            key={item.id}
            className={index === section ? 'stage-section is-current' : 'stage-section'}
            data-stage-section={item.label}
            data-stage-section-index={index}
          >
            <h2 className="stage-section-label">{item.label}</h2>
            {item.lines.map((line) => {
              if (line.type === 'lyric') return <StageLyricLine key={line.id} line={line} />
              if (line.type === 'bars') return <StageBarLine key={line.id} line={line} />
              return <p className="stage-comment" key={line.id}>{line.text}</p>
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

export function ProjectorView({ song, onExit }: { song: Song; onExit: () => void }) {
  const slides = song.sections.filter((section) => section.lines.some((line) => line.type === 'lyric' && line.text.trim()))
  const [index, setIndex] = useState(0)
  const slide = slides[Math.min(index, Math.max(0, slides.length - 1))]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') setIndex((value) => Math.min(slides.length - 1, value + 1))
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, slides.length])
  return (
    <div className="projector" onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}>
      <button className="text-button" type="button" style={{ position: 'absolute', top: 12, left: 12 }} onClick={(event) => { event.stopPropagation(); onExit() }}>Exit</button>
      {slide?.lines.filter((line) => line.type === 'lyric').map((line) => line.type === 'lyric' ? <p key={line.id}>{line.text}</p> : null)}
      <p className="meta" style={{ position: 'absolute', bottom: 16 }}>{song.title} · {slide?.label} · {Math.min(index + 1, slides.length)}/{slides.length}</p>
    </div>
  )
}
