import { ArrowsClockwiseIcon, CaretLeftIcon, CloudCheckIcon, CloudSlashIcon, CloudWarningIcon, ShareNetworkIcon, SparkleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { SyncSigil } from '../components/SyncSigil'
import { Button, ConfirmSheet, Field, IconButton } from '../components/ui'
import { navigate } from '../lib/route'
import { useData } from '../lib/store'
import { formatCode } from '../lib/sync/code'
import { cloud, useSyncState } from '../lib/sync/cloud'
import { syncAvailable } from '../lib/sync/config'
import { timeAgo } from '../lib/sync/engine'
import { syncLink } from '../lib/sync/sigil'
import { toast } from '../lib/toast'

async function shareLink(link: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Endstep sync', url: link })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(link)
    toast('Link copied')
  } catch {
    toast('Couldn’t share the link')
  }
}

/**
 * Cloud sync with a code: start it on one device, then type the code, scan the sigil or open
 * the link on the others. `initialCode` comes from a scanned sigil or a shared link.
 */
export function SyncPage({ initialCode = '' }: { initialCode?: string }) {
  const sync = useSyncState()
  const { deckChosen } = useData()
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : '')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sameCode = sync.code !== null && initialCode !== '' && formatCode(initialCode) === sync.code

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true)
    setError(null)
    try {
      await what()
      setCode('')
      toast(done)
      if (!deckChosen || initialCode) navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work.')
    } finally {
      setBusy(false)
    }
  }
  const join = () => run(() => cloud.join(code), 'Synced with your other devices')

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => navigate('/mehr')} />
      </header>
      <div>
        <h1>Cloud sync</h1>
        <p className="muted">
          Games, decks, ranks, lessons and settings stay the same on your phone, iPad and computer. Each device keeps working
          offline; changes from all of them are merged, so nothing gets lost.
        </p>
      </div>

      {!syncAvailable() ? (
        <section className="panel">
          <h2>Coming soon</h2>
          <p className="muted small">Cloud sync isn’t switched on for this app yet. Until then, use a backup file.</p>
        </section>
      ) : sync.status === 'off' || (initialCode && !sameCode) ? (
        <>
          {initialCode ? (
            <section className="panel">
              <h2>Join this sync?</h2>
              <p className="muted small">
                This device’s data is merged with the data synced under this code. Nothing here gets lost.
                {sync.code && ` This device stops syncing under ${sync.code}.`}
              </p>
              <div className="sigil-code center">{formatCode(initialCode)}</div>
              {error && <p className="small danger-text">{error}</p>}
              <Button block disabled={busy} onClick={() => void join()}>
                {busy ? 'Joining…' : 'Join'}
              </Button>
            </section>
          ) : (
            <>
              <section className="panel">
                <h2>First device</h2>
                <p className="muted small">Get a sync code for your data. Then add your other devices with it.</p>
                <Button block icon={SparkleIcon} disabled={busy} onClick={() => void run(() => cloud.create(), 'Cloud sync is on')}>
                  Start syncing
                </Button>
              </section>
              <section className="panel">
                <h2>Already syncing elsewhere?</h2>
                <p className="muted small">
                  Point this device’s camera at the sync sigil on your other device, or type its code here.
                </p>
                <Field label="Sync code">
                  <input
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="XXXX-XXXX-XX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </Field>
                <Button block variant="secondary" disabled={busy || !code.trim()} onClick={() => void join()}>
                  {busy ? 'Joining…' : 'Join'}
                </Button>
              </section>
              {error && <p className="small danger-text">{error}</p>}
            </>
          )}
        </>
      ) : (
        <>
          <section className="panel">
            <h2 className="sync-status">
              {sync.status === 'error' ? (
                <CloudWarningIcon weight="fill" className="danger-text" aria-hidden="true" />
              ) : (
                <CloudCheckIcon weight="fill" aria-hidden="true" />
              )}
              {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Not synced' : 'Synced'}
            </h2>
            <p className="muted small">{sync.lastSync ? `Last synced ${timeAgo(sync.lastSync)}.` : 'Not synced yet.'}</p>
            {sync.status === 'error' && sync.error && <p className="small danger-text">{sync.error}</p>}
            <Button block variant="secondary" icon={ArrowsClockwiseIcon} disabled={sync.status === 'syncing'} onClick={() => void cloud.sync()}>
              Sync now
            </Button>
          </section>

          {sync.code && (
            <section className="panel">
              <h2>Add a device</h2>
              <p className="muted small">
                Point the other device’s camera at this card, open the shared link there, or type the code. Keep the code to
                yourself: anyone with it sees and changes your data.
              </p>
              <SyncSigil link={syncLink(sync.code, location.href)} code={sync.code} />
              <Button block variant="secondary" icon={ShareNetworkIcon} onClick={() => void shareLink(syncLink(sync.code!, location.href))}>
                Share link
              </Button>
            </section>
          )}

          <Button block variant="ghost" icon={CloudSlashIcon} onClick={() => setConfirmOff(true)}>
            Turn off on this device
          </Button>
        </>
      )}

      <ConfirmSheet
        open={confirmOff}
        title="Turn off cloud sync here?"
        text="This device stops syncing and forgets the code. Your data stays here and on your other devices."
        confirmLabel="Turn off"
        onConfirm={() => {
          cloud.disconnect()
          setConfirmOff(false)
        }}
        onClose={() => setConfirmOff(false)}
      />
    </div>
  )
}
