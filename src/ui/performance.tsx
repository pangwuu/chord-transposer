import { useEffect, useRef, useState } from 'react'
import { formatKey } from '../domain/chord'
import type { Song } from '../domain/song'

export function StageView({ songs, onExit }: { songs: Song[]; onExit: () => void }) {
  const [speed, setSpeed] = useState(3)
  const [playing, setPlaying] = useState(false)
  const [section, setSection] = useState(0)
  const [songIndex, setSongIndex] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  const song = songs[Math.min(songIndex, Math.max(0, songs.length - 1))]
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => body.current?.scrollBy({ top: speed }), 40)
    return () => window.clearInterval(timer)
  }, [playing, speed])
  useEffect(() => {
    let released = false
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then((sentinel) => { if (released) void sentinel.release(); else lock = sentinel }).catch(() => {})
    return () => { released = true; void lock?.release() }
  }, [])
  if (!song) return null
  const current = song.sections[Math.min(section, song.sections.length - 1)]
  return (
    <div className="stage">
      <div className="editor-bar">
        <button className="text-button" type="button" onClick={onExit}>Exit</button>
        <strong>{song.title}</strong>
        <span className="meta">{formatKey(song.originalKey)}</span>
        <span className="grow" />
        <button className="outline" type="button" aria-label="Slower" onClick={() => setSpeed((value) => Math.max(1, value - 1))}>−</button>
        <span>Speed {speed}</span>
        <button className="outline" type="button" aria-label="Faster" onClick={() => setSpeed((value) => Math.min(12, value + 1))}>+</button>
        <button className="primary" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Autoscroll'}</button>
        <button className="outline" type="button" onClick={() => setSection((value) => Math.min(song.sections.length - 1, value + 1))}>Next section</button>
        {songs.length > 1 && <button className="outline" type="button" onClick={() => { setSongIndex((value) => Math.min(songs.length - 1, value + 1)); setSection(0); body.current?.scrollTo({ top: 0 }) }}>Next song</button>}
      </div>
      <div className="stage-body" ref={body} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setSection((value) => event.clientY > bounds.top + bounds.height * 0.66 ? Math.min(song.sections.length - 1, value + 1) : Math.max(0, value - 1)) }}>
        {song.sections.map((item, index) => (
          <section key={item.id} style={{ opacity: index === section ? 1 : 0.45 }}>
            <p className="meta">{item.label}</p>
            {item.lines.map((line) => line.type === 'lyric' ? <p key={line.id}>{line.text}</p> : line.type === 'comment' ? <p className="comment" key={line.id}>{line.text}</p> : null)}
          </section>
        ))}
        {current && <p className="meta">{current.label}</p>}
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
