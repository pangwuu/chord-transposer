import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  InviteRefused,
  NeedsConnection,
  type ActiveBand,
  type BandInfo,
  type BandSession,
  type Invite,
} from '../domain/band'
import { parseRoute } from '../domain/route'
import type { SettingsStore } from '../domain/settings-store'
import { App } from './App'
import { CopyLinkButton, RecoveryPrompt } from './band-settings'

/** What the app is told about its band, and can ask of it. */
export type BandControls = {
  info: BandInfo | null
  rename(name: string): void
  leave(): Promise<void>
  /** An invite link opened while the app is running. */
  invite(invite: Invite): void
  /** Something the band gate wants said, shown by the app. `at` makes a repeat of the same words new. */
  notice: { text: string; at: number } | null
}

/** Set once on a device, when the recovery prompt is dismissed. */
const PROMPTED_KEY = 'csm-recovery-prompted'

/** Read outside render, like the share paste: it clears the address bar. */
export function takeLaunchInvite(): Invite | null {
  const route = parseRoute(location.hash)
  if (route?.place !== 'join') return null
  history.replaceState(null, '', location.pathname)
  return route.invite
}

type Stage =
  | { kind: 'starting' }
  | { kind: 'choosing' }
  | { kind: 'offline' }
  | { kind: 'failed' }
  | { kind: 'open'; band: ActiveBand }

/**
 * Opens this browser's band before the app: resumes it, or creates “My library”, or joins one from an invite link.
 * Only one band is open at a time; the app is mounted afresh for each.
 */
export function BandGate({
  session,
  settingsStore,
  deviceStorage,
  launchInvite,
}: {
  session: BandSession
  settingsStore: SettingsStore
  deviceStorage: () => Storage
  launchInvite: Invite | null
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'starting' })
  const [info, setInfo] = useState<BandInfo | null>(null)
  const [pending, setPending] = useState<Invite | null>(launchInvite)
  const [notice, setNotice] = useState<BandControls['notice']>(null)
  const [prompting, setPrompting] = useState(false)
  const [joining, setJoining] = useState(false)
  const active = useRef<ActiveBand | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const say = (text: string) => setNotice({ text, at: Date.now() })

  function show(band: ActiveBand, created: boolean) {
    if (active.current && active.current !== band) active.current.close()
    active.current = band
    setInfo(null)
    setStage({ kind: 'open', band })
    if (created && !prompted()) setPrompting(true)
  }

  function prompted() {
    try {
      return deviceStorage().getItem(PROMPTED_KEY) === '1'
    } catch {
      return false
    }
  }

  async function createFresh() {
    try {
      show(await session.create(), true)
    } catch (error) {
      setStage({
        kind: error instanceof NeedsConnection ? 'offline' : 'failed',
      })
    }
  }

  async function settle() {
    setStage({ kind: 'starting' })
    try {
      const resumed = await session.resume()
      if (resumed) return show(resumed, false)
    } catch {
      return setStage({ kind: 'failed' })
    }
    // A first launch from an invite link joins that band instead of making a library nobody asked for.
    if (pendingRef.current) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        return setStage({ kind: 'offline' })
      return setStage({ kind: 'choosing' })
    }
    await createFresh()
  }

  const settleRef = useRef(settle)
  settleRef.current = settle
  // Once per page: strict mode runs effects twice, and a second start would create a second library.
  const begun = useRef(false)
  useEffect(() => {
    if (begun.current) return
    begun.current = true
    void settleRef.current()
  }, [])

  // Setup finishes on its own once the connection is back.
  useEffect(() => {
    if (stage.kind !== 'offline') return
    const retry = () => void settleRef.current()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [stage.kind])

  const openBand = stage.kind === 'open' ? stage.band : null
  useEffect(() => {
    if (!openBand) return
    return openBand.watch(setInfo)
  }, [openBand])

  // An invite for the band already open needs no question.
  useEffect(() => {
    if (pending && openBand && pending.bandId === openBand.id) {
      setPending(null)
      say(`You're already in ${info?.name ?? 'this band'}`)
    }
  }, [pending, openBand, info?.name])

  async function join(invite: Invite) {
    setJoining(true)
    try {
      const band = await session.join(invite)
      setPending(null)
      show(band, false)
    } catch (error) {
      setPending(null)
      const kept = active.current ? ' Your library is unchanged.' : ''
      if (error instanceof NeedsConnection)
        say(`Joining a band needs an internet connection.${kept}`)
      else if (error instanceof InviteRefused)
        say(`That invite link didn't work. It may be old or mistyped.${kept}`)
      else say(`Couldn't join that band.${kept}`)
      if (!active.current) await createFresh()
    } finally {
      setJoining(false)
    }
  }

  function decline() {
    setPending(null)
    if (!active.current) void createFresh()
  }

  function dismissPrompt() {
    setPrompting(false)
    try {
      deviceStorage().setItem(PROMPTED_KEY, '1')
    } catch {
      // Storage is blocked: the prompt may come back next visit.
    }
  }

  const controls: BandControls = {
    info,
    notice,
    rename: (name) => void openBand?.rename(name),
    invite: (invite) => setPending(invite),
    async leave() {
      const band = active.current
      if (!band) return
      try {
        show(await session.leave(band), true)
      } catch (error) {
        say(
          error instanceof NeedsConnection
            ? 'Leaving a band needs an internet connection.'
            : "Couldn't leave the band. Try again.",
        )
      }
    },
  }

  const asking =
    pending &&
    (stage.kind === 'choosing' || (openBand && pending.bandId !== openBand.id))

  return (
    <>
      {openBand && (
        <App
          key={openBand.id}
          library={openBand.library}
          settingsStore={settingsStore}
          band={controls}
        />
      )}
      {stage.kind === 'starting' && (
        <SetupScreen title="Opening your library…" />
      )}
      {stage.kind === 'offline' && (
        <SetupScreen title="Connect to the internet to set up">
          <p>
            Your library is kept online so it can follow you to your other
            devices and your band. Setup finishes on its own once you're
            connected.
          </p>
          <button
            className="outline"
            type="button"
            onClick={() => void settle()}
          >
            Try again
          </button>
        </SetupScreen>
      )}
      {stage.kind === 'failed' && (
        <SetupScreen title="Your library didn't open">
          <p>Check your connection, then try again.</p>
          <button
            className="outline"
            type="button"
            onClick={() => void settle()}
          >
            Try again
          </button>
        </SetupScreen>
      )}
      {stage.kind === 'choosing' && !asking && (
        <SetupScreen title="Opening your library…" />
      )}
      {stage.kind !== 'open' && notice && (
        <div className="toast" role="status">
          {notice.text}
        </div>
      )}
      {asking && (
        <JoinDialog
          invite={pending}
          current={openBand ? info : null}
          busy={joining}
          onJoin={() => void join(pending)}
          onCancel={decline}
        />
      )}
      {prompting && info && !asking && (
        <RecoveryPrompt info={info} onDone={dismissPrompt} />
      )}
    </>
  )
}

function SetupScreen({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <main className="band-setup">
      <h1>{title}</h1>
      {children}
    </main>
  )
}

function JoinDialog({
  invite,
  current,
  busy,
  onJoin,
  onCancel,
}: {
  invite: Invite
  current: BandInfo | null
  busy: boolean
  onJoin: () => void
  onCancel: () => void
}) {
  const name = invite.name.trim() || 'this band'
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog band-dialog"
        role="dialog"
        aria-labelledby="join-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="join-title">Join {name}?</h2>
        <p>
          You'll see and edit its songs and setlists, and everyone in it will
          see your changes.
        </p>
        {current && current.members === 1 && (
          <p className="band-warning">
            You're the only member of “{current.name}”. It stays online, but to
            open it again you'll need its recovery link.{' '}
            <CopyLinkButton
              invite={current.invite}
              label="Copy recovery link"
              className="text-button"
            />
          </p>
        )}
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={onJoin}
          >
            {busy ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  )
}
