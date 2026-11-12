import { describe, expect, it } from 'vitest'
import { firebaseTarget } from './config'

const project = {
  VITE_FIREBASE_API_KEY: 'key-1',
  VITE_FIREBASE_AUTH_DOMAIN: 'charts.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'charts',
  VITE_FIREBASE_APP_ID: '1:23:web:45',
}

describe('firebaseTarget', () => {
  it('points at the project named by the env vars', () => {
    expect(firebaseTarget({ ...project, PROD: true })).toEqual({
      emulator: false,
      options: { apiKey: 'key-1', authDomain: 'charts.firebaseapp.com', projectId: 'charts', appId: '1:23:web:45' },
    })
  })

  it('points at the emulators in development when no project is named', () => {
    expect(firebaseTarget({ PROD: false })).toEqual({
      emulator: true,
      options: { apiKey: 'emulator', projectId: 'demo-chord-sheet-maker' },
    })
  })

  it('refuses a half-named project, and says which env vars are missing', () => {
    const { VITE_FIREBASE_APP_ID: _appId, VITE_FIREBASE_API_KEY: _apiKey, ...half } = project
    expect(() => firebaseTarget({ ...half, PROD: true })).toThrow('VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID')
  })

  it('refuses to point a deployed build at the emulators', () => {
    expect(() => firebaseTarget({ PROD: true })).toThrow('VITE_FIREBASE_API_KEY')
  })
})
