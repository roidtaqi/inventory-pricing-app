import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { registerServiceWorker } from './registerServiceWorker.ts'
import { AppAlertProvider } from './components/AppAlertProvider.tsx'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppAlertProvider>
        <App />
      </AppAlertProvider>
    </BrowserRouter>
  </StrictMode>,
)
