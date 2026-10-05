import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@fontsource-variable/nunito'
import { initInstallListener } from './lib/install'
import { startSync } from './lib/sync/cloud'
import './styles.css'

initInstallListener()
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
