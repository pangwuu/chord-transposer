import { formatKey, inferKey, notePitch, shiftKey, type Key } from './chord'
import { chordieCleaner } from './chart-paste/chordie'
import { eChordsCleaner } from './chart-paste/e-chords'
import { looksLikePage } from './chart-paste/generic'
import { normalisePaste } from './chart-paste/normalise'
import { cleanPage } from './chart-paste/shared'
import { ultimateGuitarCleaner } from './chart-paste/ultimate-guitar'
import type { ChartPasteMeta, ChartPasteSource, SiteCleaner } from './chart-paste/types'
import { importText, type ImportResult } from './import-text'
import { createId, symbolsIn, transposeSong, type IdGen, type Song } from './song'

export type ChartPasteResult = ImportResult & {
  notices?: string[]
  source?: ChartPasteSource
}

const cleaners: SiteCleaner[] = [ultimateGuitarCleaner, chordieCleaner, eChordsCleaner]

export function importChartPaste(raw: string, ids: IdGen = createId): ChartPasteResult {
  const text = normalisePaste(raw)
  const cleaner = cleaners.find((candidate) => candidate.detect(text))
  if (!cleaner && !looksLikePage(text)) return { ...importText(text, ids), notices: [] }

  const cleaned = cleaner ? cleaner.clean(text) : cleanPage(text)
  const result = importText(cleaned.body, ids)
  const applied = applyMeta(result.song, cleaned.meta, ids)
  return {
    ...result,
    song: applied.song,
    detectedKey: formatKey(applied.song.originalKey),
    keyGuessed: result.keyGuessed && !cleaned.meta.key,
    notices: [...cleaned.notices, ...applied.notices],
    source: cleaner?.id,
  }
}

/** A chart with a capo shows shapes. A stated key may name either the shapes or the sound, so compare it to the chords. */
function soundingKey(shapes: Key, stated: Key | undefined, capo: number): Key {
  if (!stated) return shiftKey(shapes, capo)
  const statesTheSound = (notePitch(shapes.tonic) + capo) % 12 === notePitch(stated.tonic) % 12
  return statesTheSound ? stated : shiftKey(stated, capo)
}

function applyMeta(song: Song, meta: ChartPasteMeta, ids: IdGen): { song: Song; notices: string[] } {
  let next: Song = { ...song, views: [...song.views] }
  const notices: string[] = []
  if (meta.title?.trim() && (!next.title || next.title === 'Untitled song')) next = { ...next, title: meta.title.trim() }
  if (meta.artist?.trim() && !next.artist) next = { ...next, artist: meta.artist.trim() }
  if (meta.key) next = { ...next, originalKey: meta.key }
  if (meta.tuning?.trim() && !isStandardTuning(meta.tuning)) {
    const note = `Tuning: ${meta.tuning.trim()}`
    next = { ...next, notes: next.notes ? `${next.notes}\n${note}` : note }
  }
  if (meta.capo && meta.capo > 0) {
    const shapes = inferKey(symbolsIn(next)) ?? meta.key ?? next.originalKey
    const concert = soundingKey(shapes, meta.key, meta.capo)
    next = {
      ...transposeSong(next, meta.capo, concert),
      originalKey: concert,
      views: [...next.views, { id: ids(), name: `Capo ${meta.capo}`, key: concert, capo: meta.capo, nashville: false }],
    }
    notices.push(`Capo ${meta.capo}: sounds in ${formatKey(concert)}, shown as ${formatKey(shapes)} shapes`)
  }
  return { song: next, notices }
}

function isStandardTuning(tuning: string): boolean {
  const normalised = tuning.replace(/\s+/g, '').toUpperCase()
  return normalised === 'EADGBE' || normalised === 'STANDARD'
}
