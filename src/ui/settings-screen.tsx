import type { ReactNode } from 'react'
import { accidentalBias, prefsForBias, type AccidentalBias } from '../domain/chord'
import { ACCENTS, type Accent, type Settings } from '../domain/library-types'

const ACCENT_NAMES: Record<Accent, string> = { ink: 'Ink', teal: 'Teal', plum: 'Plum', clay: 'Clay', graphite: 'Graphite' }

export function SettingsScreen({
  settings,
  onChange,
  onBackup,
  onRestore,
}: {
  settings: Settings
  onChange: (settings: Settings) => void
  onBackup: () => void
  onRestore: (file: File) => void
}) {
  const bias = accidentalBias(settings.prefs)

  function setBias(next: AccidentalBias) {
    onChange({ ...settings, prefs: prefsForBias(next) })
  }

  return (
    <div className="settings">
      <h2>Settings</h2>

      <SettingsGroup title="Appearance">
        <SettingsRow label="Theme" description="Follow the device, or always light or dark.">
          <select className="select" aria-label="Theme" value={settings.theme} onChange={(event) => onChange({ ...settings, theme: event.target.value as Settings['theme'] })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Accent" description="Marks the one main thing on screen." stacked>
          <div className="accent-options" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((accent) => (
              <label key={accent} className="accent-option">
                <input type="radio" name="accent" checked={(settings.accent ?? 'ink') === accent} onChange={() => onChange({ ...settings, accent })} />
                <span className="accent-swatch" data-swatch={accent} aria-hidden="true" />
                {ACCENT_NAMES[accent]}
              </label>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Text size" description="Lyrics and chords in the editor.">
          <select className="select" aria-label="Text size" value={settings.textSize} onChange={(event) => onChange({ ...settings, textSize: event.target.value as Settings['textSize'] })}>
            <option value="s">Small</option>
            <option value="m">Medium</option>
            <option value="l">Large</option>
          </select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Chords">
        <SettingsRow label="Chord names" description="Rewrite aliases such as Cmin and CM7 to one spelling.">
          <label className="switch-row"><input type="checkbox" aria-label="Normalise chord names" checked={settings.normalise} onChange={(event) => onChange({ ...settings, normalise: event.target.checked })} /> Normalise</label>
        </SettingsRow>
        <SettingsRow label="Accidentals" description="How sharps and flats are spelled when transposing.">
          <div className="choice-list" role="radiogroup" aria-label="Accidental spelling">
            <label><input type="radio" name="enharmonic-bias" checked={bias === 'default'} onChange={() => setBias('default')} /> Key-aware (F# · Db)</label>
            <label><input type="radio" name="enharmonic-bias" checked={bias === 'flats'} onChange={() => setBias('flats')} /> Prefer flats</label>
            <label><input type="radio" name="enharmonic-bias" checked={bias === 'sharps'} onChange={() => setBias('sharps')} /> Prefer sharps</label>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="PDF defaults">
        <SettingsRow label="Paper" description="Used for new exports.">
          <select className="select" aria-label="Default paper" value={settings.paper} onChange={(event) => onChange({ ...settings, paper: event.target.value as Settings['paper'] })}>
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
          </select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsRow label="Backup" description="Songs, setlists and settings as one .json file. Everything stays on this device otherwise.">
          <div className="data-actions">
            <button className="outline" type="button" onClick={onBackup}>Export backup</button>
            <label className="outline file-pick">
              Restore…
              <input aria-label="Restore backup" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRestore(file) }} />
            </label>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" aria-label={title}>
      <h3>{title}</h3>
      <div className="settings-card">{children}</div>
    </section>
  )
}

function SettingsRow({ label, description, stacked = false, children }: { label: string; description: string; stacked?: boolean; children: ReactNode }) {
  return (
    <div className={stacked ? 'settings-row stacked' : 'settings-row'}>
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-description">{description}</span>
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}
