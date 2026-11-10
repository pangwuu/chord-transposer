/**
 * Three variants of Stage/Play reading, switchable via ?variant=A|B|C.
 * Throwaway prototype — pick a winner, then fold into StageView and delete the rest.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Song } from '../../../domain/song'
import { PrototypeSwitcher } from '../PrototypeSwitcher'
import { VariantA, variantName as nameA } from './VariantA'
import { VariantB, variantName as nameB } from './VariantB'
import { VariantC, variantName as nameC } from './VariantC'

const VARIANTS = [
  { key: 'A', name: nameA },
  { key: 'B', name: nameB },
  { key: 'C', name: nameC },
] as const

type Key = (typeof VARIANTS)[number]['key']

function readVariant(): Key {
  const value = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  if (value === 'B' || value === 'C' || value === 'A') return value
  return 'A'
}

function writeVariant(key: Key) {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', key)
  window.history.replaceState({}, '', url)
}

export function PlayModePrototype({ songs, onExit }: { songs: Song[]; onExit: () => void }) {
  const [variant, setVariant] = useState<Key>(() => readVariant())

  const select = useCallback((key: string) => {
    const next = (key === 'B' || key === 'C' || key === 'A' ? key : 'A') as Key
    writeVariant(next)
    setVariant(next)
  }, [])

  useEffect(() => {
    const onPop = () => setVariant(readVariant())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="stage">
      {variant === 'A' && <VariantA songs={songs} onExit={onExit} />}
      {variant === 'B' && <VariantB songs={songs} onExit={onExit} />}
      {variant === 'C' && <VariantC songs={songs} onExit={onExit} />}
      {import.meta.env.DEV && (
        <PrototypeSwitcher
          variants={[...VARIANTS]}
          current={variant}
          onChange={select}
        />
      )}
    </div>
  )
}
