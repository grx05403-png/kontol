import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactLenis } from 'lenis/react'
import 'lenis/dist/lenis.css'
import App from './App'
import './styles.css'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {prefersReducedMotion ? <App /> : (
      <ReactLenis root options={{ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9 }}>
        <App />
      </ReactLenis>
    )}
  </StrictMode>,
)
