import { useEffect, useState } from 'react'
import type { BandInfo, Invite } from '../domain/band'
import { inviteLink } from '../domain/route'

export async function copyBandLink(invite: Invite): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(inviteLink(invite))
    return true
  } catch {
    return false
  }
}

/** Copies the band's link, and says so on the button itself. */
export function CopyLinkButton({
  invite,
  label = 'Copy link',
  className = 'outline',
}: {
  invite: Invite
  label?: string
  className?: string
}) {
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => {
    if (!said) return
    const timer = window.setTimeout(() => setSaid(null), 2000)
    return () => window.clearTimeout(timer)
  }, [said])
  return (
    <button
      className={className}
      type="button"
      onClick={() =>
        void copyBandLink(invite).then((ok) =>
          setSaid(ok ? 'Copied' : "Couldn't copy"),
        )
      }
    >
      {said ?? label}
    </button>
  )
}

/** The band group at the top of Settings. A band of one sees its link as the recovery link; a bigger band as the invite link. */
export function BandSettings({
  info,
  onRename,
  onLeave,
}: {
  info: BandInfo | null
  onRename: (name: string) => void
  onLeave: () => void
}) {
  const [draft, setDraft] = useState(info?.name ?? '')
  useEffect(() => setDraft(info?.name ?? ''), [info?.name])
  if (!info) return null
  const alone = info.members === 1
  const commit = () => {
    const name = draft.trim()
    if (name && name !== info.name) onRename(name.slice(0, 80))
    else setDraft(info.name)
  }
  return (
    <>
      <div className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-label">Name</span>
          <span className="settings-row-description">
            {alone
              ? 'Only you are in this library.'
              : `${info.members} members share this library.`}
          </span>
        </div>
        <div className="settings-row-control">
          <input
            className="field"
            aria-label="Band name"
            maxLength={80}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-label">
            {alone ? 'Recovery link' : 'Invite link'}
          </span>
          <span className="settings-row-description">
            {alone
              ? 'The only way to open this library on a new browser, or after this one is cleared. Keep it somewhere safe. Send it to someone to make them a member.'
              : 'Anyone with this link can join, and see and edit every song and setlist. It is also your way back in on a new browser.'}
          </span>
        </div>
        <div className="settings-row-control">
          <CopyLinkButton invite={info.invite} />
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-label">Leave</span>
          <span className="settings-row-description">
            Stop seeing this library here. A fresh “My library” opens instead.
          </span>
        </div>
        <div className="settings-row-control">
          <button className="outline" type="button" onClick={onLeave}>
            Leave…
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * Asks before leaving. With others in the band, one confirmation is enough.
 * As the last member, leaving locks everyone out for good unless the recovery link or a backup is kept,
 * so the dialog offers both and asks for the library's name before it will go.
 */
export function LeaveBandDialog({
  info,
  songCount,
  setlistCount,
  onBackup,
  onLeave,
  onCancel,
}: {
  info: BandInfo
  songCount: number
  setlistCount: number
  onBackup: () => void
  onLeave: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const alone = info.members === 1
  const confirmed = !alone || typed.trim() === info.name.trim()
  const leave = () => {
    setBusy(true)
    onLeave()
  }
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog band-dialog"
        role="dialog"
        aria-labelledby="leave-title"
        onClick={(event) => event.stopPropagation()}
      >
        {alone ? (
          <>
            <h2 id="leave-title">Leave {info.name} for good?</h2>
            <p className="band-warning">
              You're its only member. Once you leave, nobody can open this
              library or its {count(songCount, 'song', 'songs')} and{' '}
              {count(setlistCount, 'setlist', 'setlists')} again, unless you've
              kept its recovery link or a backup.
            </p>
            <div className="data-actions">
              <button className="outline" type="button" onClick={onBackup}>
                Download backup
              </button>
              <CopyLinkButton invite={info.invite} label="Copy recovery link" />
            </div>
            <label className="band-confirm">
              Type <strong>{info.name}</strong> to confirm
              <input
                className="field"
                aria-label="Library name to confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </label>
          </>
        ) : (
          <>
            <h2 id="leave-title">Leave {info.name}?</h2>
            <p>
              You'll stop seeing its songs and setlists here. The other{' '}
              {count(info.members - 1, 'member keeps', 'members keep')} them. A
              fresh “My library” opens instead.
            </p>
          </>
        )}
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary danger"
            type="button"
            disabled={!confirmed || busy}
            onClick={leave}
          >
            {alone ? 'Leave and lose access' : 'Leave band'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shown once per device, after a library is created: without its link, a cleared browser loses it. */
export function RecoveryPrompt({
  info,
  onDone,
}: {
  info: BandInfo
  onDone: () => void
}) {
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  return (
    <div className="dialog-backdrop">
      <div
        className="dialog band-dialog"
        role="dialog"
        aria-labelledby="recovery-title"
      >
        <h2 id="recovery-title">Save your recovery link</h2>
        <p>
          Your library is kept online. This link is the only way to open it on a
          new browser, or after this one's data is cleared. Save it in your
          notes or password manager.
        </p>
        <div className="data-actions">
          <CopyLinkButton
            invite={info.invite}
            label="Copy recovery link"
            className="primary"
          />
          {canShare && (
            <button
              className="outline"
              type="button"
              onClick={() =>
                void navigator
                  .share({
                    title: `${info.name} recovery link`,
                    url: inviteLink(info.invite),
                  })
                  .catch(() => {})
              }
            >
              Share…
            </button>
          )}
        </div>
        <p className="meta">It's also in Settings, under Band.</p>
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
