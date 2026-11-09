import { useState } from 'react'
import {
  capoLine,
  MAJOR_KEYS,
  MINOR_KEYS,
  readChord,
  shiftKey,
  transposeChord,
  writeChord,
  type KeyName,
} from './chord/chord'

type Example = {
  label: string
  raw: string
  from: KeyName
  to: KeyName
  capo: number
}

const EXAMPLES: Example[] = [
  { label: 'F/A in F → E', raw: 'F/A', from: 'F', to: 'E', capo: 0 },
  { label: 'Bb in F → E', raw: 'Bb', from: 'F', to: 'E', capo: 0 },
  { label: 'G in C → B', raw: 'G', from: 'C', to: 'B', capo: 0 },
  { label: 'Capo 4 in B', raw: 'G', from: 'C', to: 'B', capo: 4 },
]

function KeySelect({
  id,
  value,
  onChange,
}: {
  id?: string
  value: KeyName
  onChange: (key: KeyName) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as KeyName)}
    >
      <optgroup label="Major">
        {MAJOR_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </optgroup>
      <optgroup label="Minor">
        {MINOR_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

export function App() {
  const [raw, setRaw] = useState('F/A')
  const [fromKey, setFromKey] = useState<KeyName>('F')
  const [toKey, setToKey] = useState<KeyName>('E')
  const [capo, setCapo] = useState(0)
  const [normalize, setNormalize] = useState(false)

  const trimmed = raw.trim()
  const reading = trimmed.length > 0 ? readChord(trimmed) : null
  const valid = reading?.ok === true
  const output =
    reading?.ok === true
      ? writeChord(transposeChord(reading.chord, fromKey, toKey), { normalize })
      : null
  const capoText = capoLine(toKey, capo)
  const transposed = fromKey !== toKey

  return (
    <div className="app">
      <header className="topbar">
        <p className="brand">Chord Sheet Maker</p>
      </header>
      <main className="sheet">
        <h1>Check a chord</h1>
        <p className="lede">
          The chord stays exactly as typed until it parses. Transposing spells
          it for the key you are sounding in.
        </p>

        <label className="field" htmlFor="chord">
          Chord
          <input
            id="chord"
            className={reading && !valid ? 'invalid' : undefined}
            value={raw}
            aria-invalid={reading ? !valid : undefined}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setRaw(event.target.value)}
          />
        </label>
        {reading && !valid ? (
          <p className="flag" role="status">
            Can’t read <span className="raw-flag">{reading.raw}</span>. Left as
            typed.
          </p>
        ) : null}

        <div className="keys">
          <label>
            Written in
            <KeySelect value={fromKey} onChange={setFromKey} />
          </label>
          <div className="sounding">
            <label htmlFor="sounds">Sounds in</label>
            <div className="sounding-row">
              <button
                type="button"
                aria-label="Sound a semitone lower"
                onClick={() => setToKey(shiftKey(toKey, -1))}
              >
                −
              </button>
              <KeySelect id="sounds" value={toKey} onChange={setToKey} />
              <button
                type="button"
                aria-label="Sound a semitone higher"
                onClick={() => setToKey(shiftKey(toKey, 1))}
              >
                +
              </button>
            </div>
          </div>
          <label>
            Capo
            <input
              type="number"
              min={0}
              max={11}
              value={capo}
              onChange={(event) => setCapo(Number(event.target.value))}
            />
          </label>
        </div>

        <section className="result" aria-live="polite">
          <p className="result-label">Sounding chord</p>
          <p className="chord-out">{output ?? '—'}</p>
          {transposed && valid ? (
            <p className="from-chip">From {fromKey}</p>
          ) : null}
          {capoText ? <p className="capo">{capoText}</p> : null}
        </section>

        <div className="examples">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                setRaw(example.raw)
                setFromKey(example.from)
                setToKey(example.to)
                setCapo(example.capo)
              }}
            >
              {example.label}
            </button>
          ))}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={normalize}
            onChange={(event) => setNormalize(event.target.checked)}
          />
          Normalise names (Cmin → Cm, Csus → Csus4)
        </label>
      </main>
    </div>
  )
}
