import { useEffect, useRef, useState } from 'react'
import { ChevronsDown, Eye, EyeOff, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react'
import {
  accidentalBias,
  chooseAccidentalBias,
  easyChord,
  formatKey,
  keyFromPitch,
  notePitch,
  parseKey,
  shiftKey,
  type Key,
  type SpellingPrefs,
} from '../domain/chord'
import { chordSummary, displayedSong, mapSymbols, performance as playedSections, type Song } from '../domain/song'
import { symbolLabel } from './chart'
import { shortcutFor } from './shortcuts'
import { StageBarLine, StageLyricLine } from './stage-lines'

const DEFAULT_SPEED = 0.8
const MIN_SPEED = 0.1
const MAX_SPEED = 12
const SPEED_STEP = 0.1
const SWIPE_DISTANCE = 60
/** Speed is pixels per 40 ms tick, so 0.8 reads as 20 px a second. */
const SCROLL_TICKS_PER_SECOND = 25
const SECTION_TOP_SLACK = 24
const BASE_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

function keyOptions(prefs: SpellingPrefs): string[] {
  return BASE_KEYS.map((name) => {
    if (name === 'F#' && prefs.gb) return 'Gb'
    if (name === 'Db' && prefs.csharp) return 'C#'
    return name
  })
}

function nudgeSpeed(value: number, delta: number) {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round((value + delta) * 10) / 10))
}

export type StageEntry = {
  song: Song
  concert: Key
  capo: number
  /** The setlist entry's notes for this service. */
  notes?: string
}

/** What stage view was opened on, so reopening the same thing can pick up where it left off. */
export type StageSource = { kind: 'setlist' | 'song'; id: string }

const STAGE_POSITION_KEY = 'csm-stage-position'
const RESUME_WINDOW = 3 * 60 * 60 * 1000
const RESUME_NOTICE_TIME = 8000
/** Longest a scroll to a section is given to arrive. */
const JUMP_TIME = 1200

type StagePosition = { source: string; songId: string; songIndex: number; section: number; key: string; capo: number; at: number }

const sourceName = (source: StageSource) => `${source.kind}:${source.id}`

/** Where this device left the same setlist or song within the last few hours, or null to start from the top. */
function resumePosition(source: StageSource | undefined, entries: StageEntry[]): { songIndex: number; section: number; concert: Key; capo: number } | null {
  if (!source) return null
  try {
    const held = JSON.parse(localStorage.getItem(STAGE_POSITION_KEY) ?? 'null') as StagePosition | null
    if (!held || held.source !== sourceName(source) || Date.now() - held.at > RESUME_WINDOW) return null
    // The setlist may have been reordered since: the song is what was being played, not its number.
    const songIndex = entries[held.songIndex]?.song.id === held.songId ? held.songIndex : entries.findIndex((entry) => entry.song.id === held.songId)
    if (songIndex < 0) return null
    const sections = playedSections(entries[songIndex].song).length
    return {
      songIndex,
      section: Math.max(0, Math.min(sections - 1, Math.round(held.section) || 0)),
      concert: parseKey(held.key),
      capo: Math.max(0, Math.min(11, Math.round(held.capo) || 0)),
    }
  } catch {
    // Storage is blocked or holds something else: open as usual.
    return null
  }
}

const STAGE_SIZES = [18, 20, 22, 24, 28, 32, 36, 40]
const STAGE_DEFAULT_SIZE = STAGE_SIZES.indexOf(24)
const STAGE_SIZE_KEY = 'csm-stage-size'

function initialStageSize(): number {
  try {
    const saved = STAGE_SIZES.indexOf(Number(localStorage.getItem(STAGE_SIZE_KEY)))
    if (saved >= 0) return saved
  } catch { /* storage can be blocked */ }
  return typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches ? 0 : STAGE_DEFAULT_SIZE
}

/** Full-screen Quiet Chart reading view with hideable transport + autoscroll. */
export function StageView({
  entries,
  nashville: initialNashville,
  prefs: initialPrefs,
  easy: initialEasy = false,
  source,
  onExit,
}: {
  entries: StageEntry[]
  nashville: boolean
  prefs: SpellingPrefs
  easy?: boolean
  /** With a source, the position is remembered on this device and picked up on reopening. */
  source?: StageSource
  onExit: () => void
}) {
  const [resumed] = useState(() => resumePosition(source, entries))
  const [songIndex, setSongIndex] = useState(resumed?.songIndex ?? 0)
  const [section, setSection] = useState(resumed?.section ?? 0)
  const [concert, setConcert] = useState(() => resumed?.concert ?? entries[0]?.concert ?? parseKey('C'))
  const [capo, setCapo] = useState(() => resumed?.capo ?? entries[0]?.capo ?? 0)
  /** The section picked up at, named once: the section on screen moves on as the player scrolls. */
  const [backAt, setBackAt] = useState<string | null>(() => {
    if (!resumed || (resumed.songIndex === 0 && resumed.section === 0)) return null
    const song = entries[resumed.songIndex].song
    const label = playedSections(song)[resumed.section]?.section.label ?? ''
    return resumed.songIndex > 0 ? `${label} of ${song.title}` : label
  })
  /** A section being scrolled to. Until it arrives, sections passed on the way are not the current one. */
  const jump = useRef<{ target: number; until: number } | null>(null)
  const [nashville, setNashville] = useState(initialNashville)
  const [easy, setEasy] = useState(initialEasy)
  const [prefs, setPrefs] = useState(initialPrefs)
  const [headerOpen, setHeaderOpen] = useState(true)
  const [sizeIndex, setSizeIndex] = useState(initialStageSize)
  useEffect(() => {
    try { localStorage.setItem(STAGE_SIZE_KEY, String(STAGE_SIZES[sizeIndex])) } catch { /* storage can be blocked */ }
  }, [sizeIndex])
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [playing, setPlaying] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const entry = entries[Math.min(songIndex, Math.max(0, entries.length - 1))]

  // The song the key, capo and section on screen belong to. It starts as the one opened, or picked up at.
  const shownEntry = useRef(entry)
  useEffect(() => {
    if (!entry || shownEntry.current === entry) return
    shownEntry.current = entry
    setConcert(entry.concert)
    setCapo(entry.capo)
    setSection(0)
  }, [entry])

  useEffect(() => {
    if (!resumed || resumed.section === 0) return
    const target = body.current?.querySelector(`[data-stage-section-index="${resumed.section}"]`)
    if (!target || typeof target.scrollIntoView !== 'function') return
    jump.current = { target: resumed.section, until: Date.now() + JUMP_TIME }
    target.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, [resumed])

  useEffect(() => {
    if (!backAt) return
    const timer = window.setTimeout(() => setBackAt(null), RESUME_NOTICE_TIME)
    return () => window.clearTimeout(timer)
  }, [backAt])

  const sourceKey = source ? sourceName(source) : null
  const songId = entry?.song.id
  const keyName = formatKey(concert)
  useEffect(() => {
    if (!sourceKey || !songId) return
    const position: StagePosition = { source: sourceKey, songId, songIndex, section, key: keyName, capo, at: Date.now() }
    try { localStorage.setItem(STAGE_POSITION_KEY, JSON.stringify(position)) } catch { /* storage can be blocked */ }
  }, [sourceKey, songId, songIndex, section, keyName, capo])

  useEffect(() => {
    const node = body.current
    if (!playing || !node) return
    let position = node.scrollTop
    let written = node.scrollTop
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      if (Math.abs(node.scrollTop - written) > 1) position = node.scrollTop
      position += speed * SCROLL_TICKS_PER_SECOND * ((now - last) / 1000)
      last = now
      written = Math.round(position)
      node.style.scrollBehavior = 'auto'
      node.scrollTop = written
      node.style.scrollBehavior = ''
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
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

  const onKey = useRef<(event: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  if (!entry) return null

  const transposed = displayedSong(entry.song, concert, capo, prefs)
  const song = easy ? mapSymbols(transposed, easyChord) : transposed
  const played = playedSections(song)
  const shapeKey = shiftKey(concert, -capo, prefs)
  const chords = chordSummary(song, (symbol) => symbolLabel(symbol, nashville, shapeKey))
  const entryNotes = entry.notes?.trim()
  const songNotes = entry.song.notes?.trim()
  const viewDirty = formatKey(concert) !== formatKey(entry.song.originalKey) || capo > 0
  const bias = accidentalBias(prefs)
  const order = song.arrangement
    .map((item) => song.sections.find((candidate) => candidate.id === item.sectionId)?.label ?? '')
    .filter(Boolean)
    .join(' · ')

  function applyStagePrefs(next: SpellingPrefs) {
    setPrefs(next)
    setConcert((key) => keyFromPitch(notePitch(key.tonic), key.mode, next))
  }

  const goSong = (direction: 1 | -1) => {
    setSongIndex((value) => Math.min(entries.length - 1, Math.max(0, value + direction)))
    body.current?.scrollTo?.({ top: 0 })
  }

  const goSection = (direction: 1 | -1) => {
    const from = sectionInView() ?? section
    const pastEnd = direction === 1 ? from >= played.length - 1 && songIndex < entries.length - 1 : from <= 0 && songIndex > 0
    if (pastEnd) {
      goSong(direction)
      return
    }
    const next = Math.min(played.length - 1, Math.max(0, from + direction))
    const target = body.current?.querySelector(`[data-stage-section-index="${next}"]`)
    if (target && typeof target.scrollIntoView === 'function') {
      jump.current = { target: next, until: Date.now() + JUMP_TIME }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setSection(next)
  }

  const startFromTop = () => {
    setBackAt(null)
    jump.current = null
    setSongIndex(0)
    setSection(0)
    body.current?.scrollTo?.({ top: 0 })
  }

  /** Bluetooth page-turner pedals type Page Down/Up or arrow keys, so these keys drive the stage hands-free. */
  onKey.current = (event: KeyboardEvent) => {
    const action = shortcutFor(event, ['Stage'])
    if (action === 'stage-exit') return onExit()
    const target = event.target as HTMLElement | null
    if (target?.closest?.('input, select, textarea, [contenteditable="true"]')) return
    if (!action) return
    event.preventDefault()
    if (action === 'stage-play') setPlaying((value) => !value)
    else if (action === 'stage-next-section') goSection(1)
    else if (action === 'stage-previous-section') goSection(-1)
    else if (action === 'stage-next-song') goSong(1)
    else goSong(-1)
  }

  /** The section at the top of the reading area, or null when there is no layout to measure. */
  function sectionInView(): number | null {
    const node = body.current
    if (!node) return null
    const nodes = [...node.querySelectorAll<HTMLElement>('[data-stage-section-index]')]
    const rects = nodes.map((item) => item.getBoundingClientRect())
    if (rects.every((rect) => rect.height === 0)) return null
    const top = node.getBoundingClientRect().top + SECTION_TOP_SLACK
    let found = 0
    rects.forEach((rect, index) => {
      if (rect.top <= top) found = index
    })
    const atEnd = node.scrollHeight > 0 && node.scrollTop + node.clientHeight >= node.scrollHeight - 2
    return atEnd ? Math.max(found, section) : found
  }

  return (
    <div className="stage">
      <div className={headerOpen ? 'stage-chrome' : 'stage-chrome is-collapsed'}>
        <div className="stage-chrome-row">
          {headerOpen && (
            <>
              <button className="outline stage-icon" type="button" aria-label="Exit" title="Exit" onClick={onExit}>
                <X size={16} aria-hidden="true" />
              </button>
              <div className="stage-transport">
                <div className="transport-main">
                  <div className="pill" role="group" aria-label="Transpose">
                    <button className="pill-btn" type="button" aria-label="Key down a semitone" onClick={() => setConcert((value) => shiftKey(value, -1, prefs))}>−</button>
                    <select
                      className="pill-select pill-key"
                      aria-label="Key"
                      value={formatKey(concert)}
                      onChange={(event) => setConcert(parseKey(event.target.value))}
                    >
                      <optgroup label="Major">{keyOptions(prefs).map((key) => <option key={key}>{key}</option>)}</optgroup>
                      <optgroup label="Minor">{keyOptions(prefs).map((key) => <option key={`${key}m`}>{key}m</option>)}</optgroup>
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
                      aria-pressed={bias === 'flats'}
                      onClick={() => applyStagePrefs(chooseAccidentalBias(prefs, 'flats'))}
                    >
                      ♭
                    </button>
                    <span className="pill-divider" aria-hidden="true" />
                    <button
                      className="pill-btn"
                      type="button"
                      aria-label="Prefer sharps"
                      aria-pressed={bias === 'sharps'}
                      onClick={() => applyStagePrefs(chooseAccidentalBias(prefs, 'sharps'))}
                    >
                      ♯
                    </button>
                  </div>
                  <div className="transport-mode">
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
                    <div className="pill" role="group" aria-label="Easy chords">
                      <button
                        className="pill-btn"
                        type="button"
                        aria-pressed={easy}
                        title="Show plain major and minor chords. The song itself is not changed."
                        onClick={() => setEasy((value) => !value)}
                      >
                        Easy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <span className="grow" />
              <span className="stage-size" role="group" aria-label="Text size">
                <button className="outline" type="button" aria-label="Smaller text" title="Smaller text" disabled={sizeIndex === 0} onClick={() => setSizeIndex((index) => Math.max(0, index - 1))}>A−</button>
                <button className="outline stage-size-large" type="button" aria-label="Larger text" title="Larger text" disabled={sizeIndex === STAGE_SIZES.length - 1} onClick={() => setSizeIndex((index) => Math.min(STAGE_SIZES.length - 1, index + 1))}>A+</button>
              </span>
              <span className="stage-speed">
                <button className="outline" type="button" aria-label="Slower" onClick={() => setSpeed((value) => nudgeSpeed(value, -SPEED_STEP))}>−</button>
                <span>Speed {speed.toFixed(1)}</span>
                <button className="outline" type="button" aria-label="Faster" onClick={() => setSpeed((value) => nudgeSpeed(value, SPEED_STEP))}>+</button>
              </span>
              <button className="primary" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Autoscroll'}</button>
              <button className="outline stage-icon" type="button" aria-label="Next section" title="Next section" onClick={() => goSection(1)}>
                <ChevronsDown size={16} aria-hidden="true" />
              </button>
              {entries.length > 1 && (
                <>
                  <button className="outline stage-icon" type="button" aria-label="Previous song" title="Previous song" disabled={songIndex === 0} onClick={() => goSong(-1)}>
                    <SkipBack size={16} aria-hidden="true" />
                  </button>
                  <button className="outline stage-icon" type="button" aria-label="Next song" title="Next song" disabled={songIndex >= entries.length - 1} onClick={() => goSong(1)}>
                    <SkipForward size={16} aria-hidden="true" />
                  </button>
                </>
              )}
            </>
          )}
          <button
            className="stage-eye"
            type="button"
            aria-pressed={headerOpen}
            aria-label={headerOpen ? 'Hide header' : 'Show header'}
            onClick={() => setHeaderOpen((open) => !open)}
          >
            {headerOpen
              ? <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
              : <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {backAt && (
        <p className="stage-resume" role="status">
          Back at {backAt} ·{' '}
          <button className="text-button" type="button" onClick={startFromTop}>Start from the top</button>
        </p>
      )}
      <div
        className="stage-body"
        ref={body}
        style={{ fontSize: `${STAGE_SIZES[sizeIndex]}px` }}
        onScroll={() => {
          const inView = sectionInView()
          if (inView === null) return
          const pending = jump.current
          if (pending && Date.now() < pending.until && inView !== pending.target) return
          jump.current = null
          setSection(inView)
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const touch = event.changedTouches[0]
          touchStart.current = null
          if (!start || !touch || entries.length < 2) return
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
          goSong(dx < 0 ? 1 : -1)
        }}
      >
        <header className="stage-head">
          <strong className="stage-title">{song.title}</strong>
          {song.artist && <p className="stage-artist">{song.artist}</p>}
          {order && <p className="stage-order">Order: {order}</p>}
          {chords.length > 0 && (
            <p className="stage-chords" aria-label="Chords used">
              {chords.map((chord) => <span key={chord.label} className={chord.invalid ? 'invalid' : undefined}>{chord.label}</span>)}
            </p>
          )}
          {entryNotes && <p className="stage-notes" data-notes="setlist">{entryNotes}</p>}
          {songNotes && <p className="stage-notes" data-notes="song">{songNotes}</p>}
        </header>
        {played.map(({ section: item }, index) => (
          <section
            key={`${item.id}-${index}`}
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

export function ProjectorView({ songs, onExit }: { songs: Song[]; onExit: () => void }) {
  const slides = songs.flatMap((song) =>
    playedSections(song)
      .map((played) => played.section)
      .filter((section) => section.lines.some((line) => line.type === 'lyric' && line.text.trim()))
      .map((section) => ({ song, section })),
  )
  const [index, setIndex] = useState(0)
  const slide = slides[Math.min(index, Math.max(0, slides.length - 1))]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = shortcutFor(event, ['Projector'])
      if (action === 'projector-exit') onExit()
      if (action === 'projector-next') setIndex((value) => Math.min(slides.length - 1, value + 1))
      if (action === 'projector-previous') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, slides.length])
  return (
    <div className="projector" onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}>
      <button className="text-button" type="button" style={{ position: 'absolute', top: 12, left: 12 }} onClick={(event) => { event.stopPropagation(); onExit() }}>Exit</button>
      {slide?.section.lines.filter((line) => line.type === 'lyric').map((line) => line.type === 'lyric' ? <p key={line.id}>{line.text}</p> : null)}
      <p className="meta" style={{ position: 'absolute', bottom: 16 }}>{slide?.song.title} · {slide?.section.label} · {Math.min(index + 1, slides.length)}/{slides.length}</p>
    </div>
  )
}
