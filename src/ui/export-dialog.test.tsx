import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseKey } from '../domain/chord'
import { layoutPdf, layoutSetlist } from '../domain/pdf-layout'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { defaultPdfChoices, ExportDialog, SetlistExportDialog } from './export-dialog'

const options = { paper: 'a4', fontSize: 12, columns: 1, fit: 'auto', content: 'full', numbers: false, repeats: 'full', allowTwoColumns: false } as const
const songLayout = layoutPdf(amazingGrace, { ...options, capo: 0, concert: parseKey('G') })
const setlistLayout = layoutSetlist([{ song: amazingGrace, capo: 0, concert: parseKey('G') }, { song: firstLight, capo: 0, concert: firstLight.originalKey }], options, false)
const bytes = new Uint8Array([37, 80, 68, 70])

function stubShare({ files = true, share = vi.fn().mockResolvedValue(undefined) }: { files?: boolean; share?: ReturnType<typeof vi.fn> } = {}) {
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: { files?: File[] }) => files && Boolean(data.files?.length) })
  return share
}

beforeEach(() => {
  vi.useFakeTimers()
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

function renderSong(props: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
  const onDownload = vi.fn()
  const onNotice = vi.fn()
  const renderFile = vi.fn().mockResolvedValue(bytes)
  render(<ExportDialog layout={songLayout} choices={defaultPdfChoices()} accidentals="default" issueCount={0} onChange={() => {}} onAccidentals={() => {}} onClose={() => {}} onDownload={onDownload} renderFile={renderFile} onNotice={onNotice} {...props} />)
  return { onDownload, onNotice, renderFile }
}

/** Lets the dialog draw the PDF it keeps ready for the Share tap. */
async function drawn() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
}

describe('sharing a PDF from the export dialog', () => {
  it('offers only Download where files cannot be shared', async () => {
    const { renderFile } = renderSong()
    await drawn()
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    expect(renderFile).not.toHaveBeenCalled()
    cleanup()
    stubShare({ files: false })
    renderSong()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
  })

  it('shares the PDF under the same name as the download, straight from the tap', async () => {
    const share = stubShare()
    renderSong()
    const button = screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    await drawn()
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    // Called inside the click, with nothing awaited first: Safari needs that to open the sheet.
    expect(share).toHaveBeenCalledTimes(1)
    const shared = share.mock.calls[0][0] as { files: File[]; title: string }
    expect(shared.files).toHaveLength(1)
    expect(shared.files[0].name).toBe('Amazing Grace - G.pdf')
    expect(shared.files[0].type).toBe('application/pdf')
    expect(shared.files[0].size).toBe(bytes.length)
    expect(shared.title).toBe('Amazing Grace')
  })

  it('names a setlist PDF by the setlist and its date', async () => {
    const share = stubShare()
    render(<SetlistExportDialog fileName="Sunday - 2026-03-01.pdf" layout={setlistLayout} choices={defaultPdfChoices()} accidentals="default" onChange={() => {}} onAccidentals={() => {}} onClose={() => {}} onDownload={() => {}} renderFile={vi.fn().mockResolvedValue(bytes)} />)
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    const shared = share.mock.calls[0][0] as { files: File[]; title: string }
    expect(shared.files[0].name).toBe('Sunday - 2026-03-01.pdf')
    expect(shared.files[0].type).toBe('application/pdf')
    expect(shared.title).toBe('Sunday - 2026-03-01')
  })

  it('makes Share the main button on a phone', async () => {
    stubShare()
    renderSong({ phone: true })
    expect(screen.getByRole('button', { name: 'Share' }).className).toBe('primary')
    expect(screen.getByRole('button', { name: 'Download' }).className).toBe('outline')
  })

  it('says nothing when the share sheet is closed without sending', async () => {
    stubShare({ share: vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })) })
    const { onDownload, onNotice } = renderSong()
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await drawn()
    expect(onDownload).not.toHaveBeenCalled()
    expect(onNotice).not.toHaveBeenCalled()
  })

  it('downloads instead, and says so, when sharing fails', async () => {
    stubShare({ share: vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { name: 'NotAllowedError' })) })
    const { onDownload, onNotice } = renderSong()
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await drawn()
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining('downloaded instead'))
  })
})

describe('export options', () => {
  it('offers Easy chords and Chords used for a song, and Cover page only for a setlist', () => {
    const onChange = vi.fn()
    renderSong({ onChange })
    expect(screen.queryByLabelText('Cover page')).toBeNull()
    fireEvent.click(screen.getByLabelText('Easy chords'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ easyChords: true }))
    fireEvent.click(screen.getByLabelText('Show chords used'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ showChords: true }))
    cleanup()
    const onSetlist = vi.fn()
    render(<SetlistExportDialog fileName="Sunday.pdf" layout={setlistLayout} choices={defaultPdfChoices()} accidentals="default" onChange={onSetlist} onAccidentals={() => {}} onClose={() => {}} onDownload={() => {}} />)
    expect((screen.getByLabelText('Cover page') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByLabelText('Cover page'))
    expect(onSetlist).toHaveBeenLastCalledWith(expect.objectContaining({ coverPage: true }))
  })

  it('shows the cover page first in the setlist preview', () => {
    const withCover = layoutSetlist([{ song: amazingGrace, capo: 0, concert: parseKey('G'), notes: 'Opener' }], options, false, { name: 'Sunday', date: 'Sun 1 Mar 2026' })
    render(<SetlistExportDialog fileName="Sunday.pdf" layout={withCover} choices={{ ...defaultPdfChoices(), coverPage: true }} accidentals="default" onChange={() => {}} onAccidentals={() => {}} onClose={() => {}} onDownload={() => {}} />)
    const papers = [...document.querySelectorAll('.paper')]
    expect(papers[0].textContent).toContain('Running order · Sun 1 Mar 2026')
    expect(papers[0].textContent).toContain('Opener')
    expect(screen.getByText(/2 pages/)).toBeTruthy()
  })
})
