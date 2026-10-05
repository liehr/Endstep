/**
 * Activate the waiting new version and reload the app.
 *
 * Doesn't rely on the "controllerchange" event alone: in installed iOS web apps
 * it doesn't arrive reliably. The new version was then activated, but the app
 * didn't reload (only after a full restart). So we also listen for the new
 * version's state change and reload after a short timeout in any case.
 */
export async function activateUpdate(
  container: ServiceWorkerContainer | undefined = navigator.serviceWorker,
  reload: () => void = () => window.location.reload(),
  timeoutMs = 3000,
): Promise<void> {
  const waiting = (await container?.getRegistration())?.waiting
  if (waiting) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, timeoutMs)
      function done() {
        clearTimeout(timer)
        resolve()
      }
      container?.addEventListener('controllerchange', done, { once: true })
      waiting.addEventListener('statechange', () => {
        if (waiting.state === 'activated') done()
      })
      waiting.postMessage({ type: 'SKIP_WAITING' })
    })
  }
  reload()
}
