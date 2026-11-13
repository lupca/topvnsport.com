// @vitest-environment jsdom
// SEO 13/11: on a server-rendered landing main.tsx loads the catalog before the first React render;
// App must not download it a second time.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getProducts: vi.fn().mockResolvedValue([{ id: '1', name: 'Vợt Yonex', image: '', gallery: [], price: 1, tier_variations: [], variants: [], specs: {}, stock: 1 }]),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

describe('App after a pre-loaded catalog', () => {
  it('does not fetch the catalog again; a cold store still fetches on mount', async () => {
    window.scrollTo = vi.fn() as any;
    const { default: App } = await import('../App');
    const { store } = await import('../app/store');
    const { fetchAppData } = await import('../features/appData/appDataSlice');
    const { Provider } = await import('react-redux');
    const { MemoryRouter } = await import('react-router-dom');
    await store.dispatch(fetchAppData());
    expect(api.getProducts).toHaveBeenCalledTimes(1);
    render(<Provider store={store}><MemoryRouter initialEntries={['/']}><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(document.querySelector('[data-testid="featured-grid"]')).not.toBeNull());
    expect(api.getProducts).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
