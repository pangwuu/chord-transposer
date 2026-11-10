import { formatKey } from './chord'
import { chordieCleaner } from './chart-paste/chordie'
import { eChordsCleaner } from './chart-paste/e-chords'
import { ultimateGuitarCleaner } from './chart-paste/ultimate-guitar'
import type { ChartPasteMeta, ChartPasteSource, SiteCleaner } from './chart-paste/types'
import { importText, type ImportResult } from './import-text'
import { createId, type IdGen, type Song } from './song'

export type ChartPasteResult = ImportResult & {
  notices?: string[]
  source?: ChartPasteSource
}

const cleaners: SiteCleaner[] = [ultimateGuitarCleaner, chordieCleaner, eChordsCleaner]

export function importChartPaste(raw: string, ids: IdGen = createId): ChartPasteResult {
  const cleaner = cleaners.find((candidate) => candidate.detect(raw))
  if (!cleaner) {
    const result = importText(raw, ids)
    return { ...result, notices: [] }
  }

  const cleaned = cleaner.clean(raw)
  const result = importText(cleaned.body, ids)
  const song = applyMeta(result.song, cleaned.meta, ids)
  return {
    ...result,
    song,
    detectedKey: formatKey(song.originalKey),
    notices: cleaned.notices,
    source: cleaner.id,
  }
}

function applyMeta(song: Song, meta: ChartPasteMeta, ids: IdGen): Song {
  let next: Song = { ...song, views: [...song.views] }
  if (meta.title?.trim() && (!next.title || next.title === 'Untitled song')) {
    next = { ...next, title: meta.title.trim() }
  }
  if (meta.artist?.trim() && !next.artist) next = { ...next, artist: meta.artist.trim() }
  if (meta.key) next = { ...next, originalKey: meta.key }
  if (meta.tuning?.trim() && !isStandardTuning(meta.tuning)) {
    const note = `Tuning: ${meta.tuning.trim()}`
    next = { ...next, notes: next.notes ? `${next.notes}\n${note}` : note }
  }
  if (meta.capo && meta.capo > 0) {
    next = {
      ...next,
      views: [
        ...next.views,
        {
          id: ids(),
          name: `Capo ${meta.capo}`,
          key: next.originalKey,
          capo: meta.capo,
          nashville: false,
        },
      ],
    }
  }
  return next
}

function isStandardTuning(tuning: string): boolean {
  const normalised = tuning.replace(/\s+/g, '').toUpperCase()
  return normalised === 'EADGBE' || normalised === 'STANDARD'
}
