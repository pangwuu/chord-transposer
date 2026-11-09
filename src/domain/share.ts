import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import type { Song } from './song'

export function encodeShare(song: Song, limit = 12000): { ok: true; hash: string } | { ok: false; reason: 'too-large' } {
  const compressed = gzipSync(strToU8(JSON.stringify(song)), { level: 9 })
  const hash = `1.${toBase64Url(compressed)}`
  if (hash.length > limit) return { ok: false, reason: 'too-large' }
  return { ok: true, hash }
}

export function decodeShare(hash: string): Song {
  const payload = hash.startsWith('1.') ? hash.slice(2) : hash
  const json = strFromU8(gunzipSync(fromBase64Url(payload)))
  return JSON.parse(json) as Song
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
