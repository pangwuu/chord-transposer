import type { FirebaseOptions } from 'firebase/app'
import { EMULATOR_PROJECT } from './emulator'

const VARS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const

type VarName = (typeof VARS)[keyof typeof VARS]
type Env = { PROD: boolean } & Partial<Record<VarName, string>>

/**
 * Which Firebase backend this build talks to: the project in its `VITE_FIREBASE_*` env vars, or the emulators.
 * Only a development build may fall back to the emulators, so a deploy with missing vars fails loudly.
 */
export function firebaseTarget(env: Env): { options: FirebaseOptions; emulator: boolean } {
  const missing = Object.values(VARS).filter((name) => !env[name])
  const unnamed = missing.length === Object.keys(VARS).length
  if (unnamed && !env.PROD) return { options: { apiKey: 'emulator', projectId: EMULATOR_PROJECT }, emulator: true }
  if (missing.length > 0) throw new Error(`Firebase is not configured. Missing env vars: ${missing.join(', ')}`)
  const options = Object.fromEntries(Object.entries(VARS).map(([key, name]) => [key, env[name]]))
  return { options, emulator: false }
}
