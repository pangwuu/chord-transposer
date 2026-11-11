const TAB_STOP = 8

function expandTabs(line: string): string {
  if (!line.includes('\t')) return line
  let out = ''
  for (const character of line) {
    if (character === '\t') out = out.padEnd(out.length + TAB_STOP - (out.length % TAB_STOP))
    else out += character
  }
  return out
}

/** Make pasted text uniform before anything reads it. Trailing spaces stay: they show where a phone wrapped a line. */
export function normalisePaste(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .split('\n')
    .map(expandTabs)
    .join('\n')
}
