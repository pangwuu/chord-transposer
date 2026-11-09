import type { Settings } from '../domain/library-types'

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
  return (
    <div className="settings">
      <h2>Settings</h2>
      <div className="properties">
        <span>Theme</span>
        <select className="select" aria-label="Theme" value={settings.theme} onChange={(event) => onChange({ ...settings, theme: event.target.value as Settings['theme'] })}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <span>Text size</span>
        <select className="select" aria-label="Text size" value={settings.textSize} onChange={(event) => onChange({ ...settings, textSize: event.target.value as Settings['textSize'] })}>
          <option value="s">S</option>
          <option value="m">M</option>
          <option value="l">L</option>
        </select>
        <span>Chord names</span>
        <label className="hint"><input type="checkbox" checked={settings.normalise} onChange={(event) => onChange({ ...settings, normalise: event.target.checked })} /> Normalise aliases such as Cmin and CM7</label>
        <span>F# / Gb</span>
        <label className="hint"><input type="checkbox" checked={settings.prefs.gb} onChange={(event) => onChange({ ...settings, prefs: { ...settings.prefs, gb: event.target.checked } })} /> Spell F# as Gb</label>
        <span>Db / C#</span>
        <label className="hint"><input type="checkbox" checked={settings.prefs.csharp} onChange={(event) => onChange({ ...settings, prefs: { ...settings.prefs, csharp: event.target.checked } })} /> Spell Db as C#</label>
        <span>PDF paper</span>
        <select className="select" aria-label="Default paper" value={settings.paper} onChange={(event) => onChange({ ...settings, paper: event.target.value as Settings['paper'] })}>
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
        </select>
        <span>Your data</span>
        <span>
          <button className="outline" type="button" onClick={onBackup}>Export backup</button>
          <input aria-label="Restore backup" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRestore(file) }} />
        </span>
      </div>
    </div>
  )
}
