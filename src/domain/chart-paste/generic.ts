import { isChromeLine, isMetaLine } from './shared'

/** Page furniture is the only sign of a pasted page, so a clean chart is never trimmed. */
export function looksLikePage(text: string): boolean {
  if (/\{(?:title|subtitle|artist|key|capo|tempo|time|start_of_|end_of_)/i.test(text)) return false
  const lines = text.split('\n')
  return lines.filter(isChromeLine).length + lines.filter(isMetaLine).length >= 2
}
