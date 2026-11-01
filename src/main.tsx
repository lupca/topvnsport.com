import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { store } from './app/store.ts';
import './index.css';
import { SystemPopupProvider } from '@topvnsport/ui-kit';
import { initTracking } from './lib/tracking.ts';
import { captureAttribution } from './lib/attribution.ts';

initTracking();
captureAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SystemPopupProvider>
          <App />
        </SystemPopupProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
