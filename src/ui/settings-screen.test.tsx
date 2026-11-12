import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../domain/library-types'
import { SettingsScreen } from './settings-screen'

afterEach(() => cleanup())

describe('SettingsScreen accent', () => {
  it('defaults to ink blue and offers the other accents', () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} onBackup={() => {}} onRestore={() => {}} />)
    expect((screen.getByRole('radio', { name: 'Ink' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Teal' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accent: 'teal' }))
  })

  it('treats settings saved before accents existed as ink', () => {
    const { accent: _accent, ...old } = defaultSettings()
    render(<SettingsScreen settings={old as never} onChange={() => {}} onBackup={() => {}} onRestore={() => {}} />)
    expect((screen.getByRole('radio', { name: 'Ink' }) as HTMLInputElement).checked).toBe(true)
  })
})
