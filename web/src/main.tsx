import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const method = init?.method || 'GET';
    const url = typeof input === 'string' ? input : (input as any).url;
    const response = await originalFetch(input, init);
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      console.log('[fetch:response]', method, url, response.status, text.slice(0, 2000));
    } catch (err) {
      console.log('[fetch:response]', method, url, response.status, '<<unreadable body>>', err);
    }
    return response;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
