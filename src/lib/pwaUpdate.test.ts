import { describe, expect, it, vi } from 'vitest'
import { activateUpdate } from './pwaUpdate'

/** Minimal stand-in for a waiting service worker. */
function fakeWorker() {
  const listeners: Record<string, (() => void)[]> = {}
  const worker = {
    state: 'installed',
    postMessage: vi.fn(),
    addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
    fire(type: string) {
      listeners[type]?.forEach((fn) => fn())
    },
  }
  return worker
}

function fakeContainer(waiting: ReturnType<typeof fakeWorker> | null) {
  const listeners: Record<string, (() => void)[]> = {}
  return {
    getRegistration: async () => ({ waiting }),
    addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
    fire(type: string) {
      listeners[type]?.forEach((fn) => fn())
    },
  }
}

const asContainer = (c: ReturnType<typeof fakeContainer>) => c as unknown as ServiceWorkerContainer

describe('activateUpdate', () => {
  it('reloads immediately when no version is waiting', async () => {
    const reload = vi.fn()
    await activateUpdate(asContainer(fakeContainer(null)), reload)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('sends SKIP_WAITING and reloads after controllerchange', async () => {
    const worker = fakeWorker()
    const container = fakeContainer(worker)
    const reload = vi.fn()
    const pending = activateUpdate(asContainer(container), reload, 60_000)
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    container.fire('controllerchange')
    await pending
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads without controllerchange too, as soon as the new version is active (iOS)', async () => {
    const worker = fakeWorker()
    const reload = vi.fn()
    const pending = activateUpdate(asContainer(fakeContainer(worker)), reload, 60_000)
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled())
    worker.state = 'activated'
    worker.fire('statechange')
    await pending
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads after the timeout at the latest, even if no event arrives', async () => {
    vi.useFakeTimers()
    try {
      const worker = fakeWorker()
      const reload = vi.fn()
      const pending = activateUpdate(asContainer(fakeContainer(worker)), reload, 3000)
      await vi.advanceTimersByTimeAsync(3000)
      await pending
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
