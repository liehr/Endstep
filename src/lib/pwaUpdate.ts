/**
 * Wartende neue Version aktivieren und die App neu laden.
 *
 * Verlässt sich nicht allein auf das Event „controllerchange“: In installierten
 * iOS-Web-Apps kommt es nicht zuverlässig an. Dann wurde die neue Version zwar
 * aktiviert, die App lud aber nicht neu (erst nach einem kompletten Neustart).
 * Deshalb wird auch auf den Statuswechsel der neuen Version gehört und nach einer
 * kurzen Wartezeit in jedem Fall neu geladen.
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
