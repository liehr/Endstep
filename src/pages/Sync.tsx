import { ArrowsClockwiseIcon, CaretLeftIcon, CloudCheckIcon, CloudSlashIcon, CloudWarningIcon, KeyIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button, ConfirmSheet, Field, IconButton } from '../components/ui'
import { navigate } from '../lib/route'
import { useData } from '../lib/store'
import { cloud, useSyncState } from '../lib/sync/cloud'
import { timeAgo } from '../lib/sync/engine'
import { toast } from '../lib/toast'

/** A classic token that can only read and write gists, prefilled on GitHub. */
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Endstep%20sync'

/** Connect this device to the cloud copy in your GitHub account, or see how syncing goes. */
export function SyncPage() {
  const sync = useSyncState()
  const { deckChosen } = useData()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      await cloud.connect(token)
      setToken('')
      toast('Cloud sync is on')
      if (!deckChosen) navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t connect.')
    } finally {
      setBusy(false)
    }
  }

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

      {sync.status === 'off' ? (
        <section className="panel">
          <h2>Connect this device</h2>
          <p className="muted small">
            Your data is saved in a secret gist in your own GitHub account. No other server sees it.
          </p>
          <ol className="steps">
            <li>
              Open{' '}
              <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                a new GitHub token
              </a>{' '}
              (sign in if asked). Name and the “gist” box are already filled in.
            </li>
            <li>Pick an expiration (“No expiration” means you never have to do this again), then tap “Generate token”.</li>
            <li>Copy the token (starts with ghp_) and paste it here. Use the same token on each of your devices.</li>
          </ol>
          <Field label="Token">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          {error && <p className="small danger-text">{error}</p>}
          <Button block icon={KeyIcon} disabled={busy || !token.trim()} onClick={() => void connect()}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </section>
      ) : (
        <section className="panel">
          <h2 className="sync-status">
            {sync.status === 'error' ? (
              <CloudWarningIcon weight="fill" className="danger-text" aria-hidden="true" />
            ) : (
              <CloudCheckIcon weight="fill" aria-hidden="true" />
            )}
            {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Not synced' : 'Synced'}
          </h2>
          <p className="muted small">
            {sync.login && <>GitHub account @{sync.login}. </>}
            {sync.lastSync ? `Last synced ${timeAgo(sync.lastSync)}.` : 'Not synced yet.'}
          </p>
          {sync.status === 'error' && sync.error && <p className="small danger-text">{sync.error}</p>}
          <Button block variant="secondary" icon={ArrowsClockwiseIcon} disabled={sync.status === 'syncing'} onClick={() => void cloud.sync()}>
            Sync now
          </Button>
          <Button block variant="ghost" icon={CloudSlashIcon} onClick={() => setConfirmOff(true)}>
            Turn off on this device
          </Button>
        </section>
      )}

      <ConfirmSheet
        open={confirmOff}
        title="Turn off cloud sync here?"
        text="This device stops syncing and forgets the token. Your data stays here and in the cloud."
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
