import { useSyncExternalStore } from 'react'

let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Show a short confirmation at the bottom edge. */
export function toast(text: string) {
  message = text
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    emit()
  }, 3500)
  emit()
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => message,
  )
}
