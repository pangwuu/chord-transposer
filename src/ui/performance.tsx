import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  formatKey,
  parseKey,
  shiftKey,
  type Key,
  type SpellingPrefs,
} from '../domain/chord'
import { displayedSong, type Song } from '../domain/song'
import { StageBarLine, StageLyricLine } from './stage-lines'

const CHROME_IDLE_MS = 2600
const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export type StageEntry = {
  song: Song
  concert: Key
  capo: number
}

/** Full-screen Quiet Chart reading view with hideable transport + autoscroll. */
export function StageView({
  entries,
  nashville: initialNashville,
  prefs: initialPrefs,
  onExit,
}: {
  entries: StageEntry[]
  nashville: boolean
  prefs: SpellingPrefs
  onExit: () => void
}) {
  const [songIndex, setSongIndex] = useState(0)
  const [section, setSection] = useState(0)
  const [concert, setConcert] = useState(() => entries[0]?.concert ?? parseKey('C'))
  const [capo, setCapo] = useState(() => entries[0]?.capo ?? 0)
  const [nashville, setNashville] = useState(initialNashville)
  const [prefs, setPrefs] = useState(initialPrefs)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [chromePinned, setChromePinned] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [playing, setPlaying] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number>()
  const entry = entries[Math.min(songIndex, Math.max(0, entries.length - 1))]

  useEffect(() => {
    if (!entry) return
    setConcert(entry.concert)
    setCapo(entry.capo)
    setSection(0)
  }, [entry])

  const revealChrome = () => {
    setChromeVisible(true)
    window.clearTimeout(hideTimer.current)
    if (chromePinned) return
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS)
  }

  const holdChrome = () => {
    setChromeVisible(true)
    window.clearTimeout(hideTimer.current)
  }

  useEffect(() => {
    revealChrome()
    return () => window.clearTimeout(hideTimer.current)
  }, [songIndex, chromePinned])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => body.current?.scrollBy({ top: speed }), 40)
    return () => window.clearInterval(timer)
  }, [playing, speed])

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
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
      revealChrome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, chromePinned])

  if (!entry) return null

  const song = displayedSong(entry.song, concert, capo, prefs)
  const shapeKey = shiftKey(concert, -capo, prefs)
  const viewDirty = formatKey(concert) !== formatKey(entry.song.originalKey) || capo > 0

  const goSection = (direction: 1 | -1) => {
    setSection((value) => {
      const next = Math.min(song.sections.length - 1, Math.max(0, value + direction))
      const target = body.current?.querySelector(`[data-stage-section-index="${next}"]`)
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return next
    })
    revealChrome()
  }

  return (
    <div className="stage" onPointerDown={revealChrome} onMouseMove={revealChrome}>
      <div
        className={chromeVisible ? 'stage-chrome' : 'stage-chrome is-hidden'}
        aria-hidden={!chromeVisible}
        onPointerEnter={holdChrome}
        onPointerLeave={() => { if (!chromePinned) revealChrome() }}
        onFocus={holdChrome}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !chromePinned) revealChrome()
        }}
      >
        <div className="stage-chrome-row">
          <button className="text-button" type="button" onClick={onExit}>Exit</button>
          <span className="stage-key">{formatKey(concert)}</span>
          <span className="grow" />
          <button className="outline" type="button" aria-pressed={chromePinned} onClick={() => setChromePinned((value) => !value)}>
            {chromePinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="outline" type="button" aria-label="Slower" onClick={() => setSpeed((value) => Math.max(1, value - 1))}>−</button>
          <span>Speed {speed}</span>
          <button className="outline" type="button" aria-label="Faster" onClick={() => setSpeed((value) => Math.min(12, value + 1))}>+</button>
          <button className="primary" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Autoscroll'}</button>
          <button className="outline" type="button" onClick={() => goSection(1)}>Next section</button>
          {entries.length > 1 && (
            <button
              className="outline"
              type="button"
              onClick={() => {
                setSongIndex((value) => Math.min(entries.length - 1, value + 1))
                body.current?.scrollTo({ top: 0 })
                revealChrome()
              }}
            >
              Next song
            </button>
          )}
        </div>
        <div className="stage-transport transport">
          <div className="transport-main">
            <div className="pill" role="group" aria-label="Transpose">
              <button className="pill-btn" type="button" aria-label="Key down a semitone" onClick={() => setConcert((value) => shiftKey(value, -1, prefs))}>−</button>
              <select
                className="pill-select pill-key"
                aria-label="Key"
                value={formatKey(concert)}
                onChange={(event) => setConcert(parseKey(event.target.value))}
              >
                <optgroup label="Major">{KEYS.map((key) => <option key={key}>{key}</option>)}</optgroup>
                <optgroup label="Minor">{KEYS.map((key) => <option key={`${key}m`}>{key}m</option>)}</optgroup>
              </select>
              <button className="pill-btn" type="button" aria-label="Key up a semitone" onClick={() => setConcert((value) => shiftKey(value, 1, prefs))}>+</button>
              <span className="pill-divider" aria-hidden="true" />
              <label className="pill-capo">
                <span className="pill-capo-label">Capo</span>
                <select
                  className="pill-select"
                  aria-label="Capo"
                  value={capo}
                  onChange={(event) => setCapo(Math.max(0, Math.min(11, Number(event.target.value))))}
                >
                  {Array.from({ length: 12 }, (_, value) => (
                    <option key={value} value={value}>{value === 0 ? 'None' : value}</option>
                  ))}
                </select>
              </label>
              <span className="pill-divider" aria-hidden="true" />
              <button
                className="pill-btn pill-icon"
                type="button"
                aria-label="Reset transpose"
                disabled={!viewDirty}
                onClick={() => {
                  setConcert(entry.song.originalKey)
                  setCapo(0)
                }}
              >
                <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="pill" role="group" aria-label="Accidental spelling">
              <button
                className="pill-btn"
                type="button"
                aria-label="Prefer flats"
                aria-pressed={prefs.gb}
                onClick={() => setPrefs((current) => ({ ...current, gb: !current.gb }))}
              >
                ♭
              </button>
              <span className="pill-divider" aria-hidden="true" />
              <button
                className="pill-btn"
                type="button"
                aria-label="Prefer sharps"
                aria-pressed={prefs.csharp}
                onClick={() => setPrefs((current) => ({ ...current, csharp: !current.csharp }))}
              >
                ♯
              </button>
            </div>
            <div className="transport-mode">
              <span className="transport-label">Numbers</span>
              <div className="pill" role="group" aria-label="Nashville numbers">
                <button
                  className="pill-btn"
                  type="button"
                  aria-pressed={nashville}
                  onClick={() => setNashville((value) => !value)}
                >
                  1-4-5
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="stage-body" ref={body} onScroll={revealChrome}>
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
              if (line.type === 'lyric') {
                return <StageLyricLine key={line.id} line={line} numbers={nashville} shapeKey={shapeKey} />
              }
              if (line.type === 'bars') {
                return <StageBarLine key={line.id} line={line} numbers={nashville} shapeKey={shapeKey} />
              }
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
