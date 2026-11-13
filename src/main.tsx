import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { store } from './app/store.ts';
import { fetchAppData } from './features/appData/appDataSlice.ts';
import './index.css';
import { SystemPopupProvider } from '@topvnsport/ui-kit';
import { initTracking } from './lib/tracking.ts';
import { captureAttribution } from './lib/attribution.ts';

initTracking();
captureAttribution();

// index.html loads the bundle CSS without blocking (see vite.config.ts): render only once it is applied, never unstyled.
function cssReady(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[data-deferred-css]');
  if (!link || link.media !== 'print') return Promise.resolve();
  return new Promise(resolve => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

// Server-rendered home/catalog (api/page.ts, #ssr): keep that content on screen until the catalog has
// loaded (at most SSR_WAIT_MS), so React replaces it with the real page instead of the loading skeleton.
const SSR_WAIT_MS = 6000;
function catalogReady(): Promise<unknown> {
  if (!document.getElementById('ssr') || !store.getState().appData.isLoading) return Promise.resolve();
  return Promise.race([store.dispatch(fetchAppData()), new Promise(resolve => setTimeout(resolve, SSR_WAIT_MS))]);
}

void Promise.all([cssReady(), catalogReady()]).then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SystemPopupProvider>
          <App />
        </SystemPopupProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
));
