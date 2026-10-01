// @vitest-environment jsdom
// STOR-011: mỗi nhóm trường hồ sơ người bán -- có thì hiện, thiếu thì không hiện. Toàn giá trị GIẢ.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import Footer from '../components/Footer';
import Header from '../components/Header';
import TrustBadges from '../components/TrustBadges';
import TrustSealsPanel from '../components/TrustSealsPanel';
import CartModal, { CartItem } from '../components/CartModal';
import StoreLocator from '../components/StoreLocator';
import { sportApi } from '../services/sportApi';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));
vi.mock('../services/sportApi', async () => {
  const real = await vi.importActual<typeof import('../services/sportApi')>('../services/sportApi');
  return {
    sportApi: {
      ...real.sportApi,
      sendOtp: vi.fn().mockResolvedValue({}),
      findOrCreateCustomer: vi.fn().mockResolvedValue('cus-gia'),
      getOrCreateStorefrontChannelId: vi.fn().mockResolvedValue('ch-gia'),
      createOrder: vi.fn().mockResolvedValue({ id: 'o-gia', order_number: 'DON-GIA-1' }),
    },
  };
});
vi.mock('../components/OtpModal', () => ({
  default: ({ isOpen, onSuccess }: { isOpen: boolean; onSuccess: (t: string) => void }) =>
    isOpen ? <button onClick={() => onSuccess('token-gia')}>OTP-GIA-XAC-THUC</button> : null,
}));

const FULL = {
  hotline: 'HOTLINE-GIA-0001', hotlineHours: 'GIO-GIA', email: 'gia@example.invalid', address: 'DIA-CHI-GIA 1',
  businessLicense: 'ĐKKD GIẢ 0000', tagline: 'TAGLINE-GIA', footerSlogan: 'SLOGAN-GIA',
  authenticityPolicy: 'CHINH-HANG-GIA', warrantyPolicy: 'BAO-HANH-GIA', stringWarrantyPolicy: 'BAO-HANH-LUOI-GIA',
  frameWarrantyPolicy: 'BAO-HANH-KHUNG-GIA', orderWarrantyNote: 'GHI-CHU-DON-GIA', headquartersNote: 'TRU-SO-GIA',
  codPolicy: 'COD-GIA', storeNote: 'CUA-HANG-GIA',
  branches: [{ id: 'cn1', name: 'CHI-NHANH-GIA', address: 'DIA-CHI-GIA 2', phone: 'SDT-GIA-0002', schedule: 'LICH-GIA', city: 'THANH-PHO-GIA' }],
};
type Key = keyof typeof FULL;
const without = (...keys: Key[]) => {
  const p: Record<string, unknown> = { ...FULL };
  keys.forEach(k => delete p[k]);
  return p;
};
const setProfile = (p: Record<string, unknown>) => vi.stubEnv('VITE_SELLER_PROFILE', JSON.stringify(p));
const txt = () => document.body.textContent ?? '';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const renderFooter = () => render(<MemoryRouter><Footer categories={[]} products={[]} /></MemoryRouter>);
const renderHeader = () => render(
  <MemoryRouter><Header cartCount={0} openCart={() => {}} products={[]} categories={[]} /></MemoryRouter>
);

describe('Footer', () => {
  it('Footer shows the licence line when businessLicense is set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('ĐKKD GIẢ 0000')).toBeInTheDocument();
  });
  it('Footer hides the licence line when businessLicense is missing', () => {
    setProfile(without('businessLicense')); renderFooter();
    expect(screen.queryByTestId('footer-licence')).toBeNull();
    expect(txt()).not.toContain('ĐKKD');
  });
  it('Footer shows address, hotline and email when set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('DIA-CHI-GIA 1')).toBeInTheDocument();
    expect(screen.getByText('HOTLINE-GIA-0001 (GIO-GIA)')).toBeInTheDocument();
    expect(screen.getByText('gia@example.invalid')).toBeInTheDocument();
  });
  it('Footer hides the contact block when all contact fields are missing', () => {
    setProfile(without('address', 'hotline', 'email')); renderFooter();
    expect(screen.queryByText('Trụ sở & Liên hệ')).toBeNull();
  });
  it('Footer shows the authenticity pillar when authenticityPolicy is set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('CHINH-HANG-GIA')).toBeInTheDocument();
  });
  it('Footer hides the authenticity pillar when authenticityPolicy is missing', () => {
    setProfile(without('authenticityPolicy')); renderFooter();
    expect(screen.queryByText('CAM KẾT CHÍNH HÃNG')).toBeNull();
  });
  it('Footer shows the warranty pillar when warrantyPolicy is set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('BAO-HANH-GIA')).toBeInTheDocument();
    expect(screen.getByText('Chính sách bảo hành')).toBeInTheDocument();
  });
  it('Footer hides the warranty pillar when warrantyPolicy is missing', () => {
    setProfile(without('warrantyPolicy')); renderFooter();
    expect(screen.queryByText('BẢO HÀNH')).toBeNull();
    expect(screen.queryByText('Chính sách bảo hành')).toBeNull();
  });
  it('Footer shows the tagline when tagline is set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('TAGLINE-GIA')).toBeInTheDocument();
  });
  it('Footer hides the tagline when tagline is missing', () => {
    setProfile(without('tagline')); renderFooter();
    expect(txt()).not.toContain('TAGLINE-GIA');
    expect(txt()).not.toContain('Hệ thống siêu thị');
  });
  it('Footer shows the footerSlogan when footerSlogan is set', () => {
    setProfile(FULL); renderFooter();
    expect(txt()).toContain('© 2026 TopVNSport. SLOGAN-GIA');
  });
  it('Footer hides the footerSlogan when footerSlogan is missing', () => {
    setProfile(without('footerSlogan')); renderFooter();
    expect(txt()).not.toContain('SLOGAN-GIA');
    expect(txt()).toContain('© 2026 TopVNSport.');
  });
  it('Footer shows the store pillar when headquartersNote is set', () => {
    setProfile(FULL); renderFooter();
    expect(screen.getByText('CỬA HÀNG TRẢI NGHIỆM')).toBeInTheDocument();
    expect(screen.getByText('TRU-SO-GIA')).toBeInTheDocument();
  });
  it('Footer hides the store pillar when headquartersNote is missing', () => {
    setProfile(without('headquartersNote')); renderFooter();
    expect(screen.queryByTestId('footer-store-pillar')).toBeNull();
    expect(screen.queryByText('CỬA HÀNG TRẢI NGHIỆM')).toBeNull();
  });
});

describe('Header', () => {
  it('Header shows the hotline when hotline is set', () => {
    setProfile(FULL); renderHeader();
    fireEvent.click(screen.getByLabelText('Open mobile menu'));
    expect(screen.getByTestId('topbar-hotline')).toHaveTextContent('HOTLINE-GIA-0001 (GIO-GIA)');
    expect(screen.getByTestId('drawer-hotline')).toHaveTextContent('HOTLINE-GIA-0001');
  });
  it('Header hides the hotline in the top bar and the drawer when hotline is missing', () => {
    setProfile(without('hotline')); renderHeader();
    fireEvent.click(screen.getByLabelText('Open mobile menu'));
    expect(screen.queryByTestId('topbar-hotline')).toBeNull();
    expect(screen.queryByTestId('drawer-hotline')).toBeNull();
    expect(txt()).not.toContain('Hotline');
    expect(txt()).not.toContain('HOTLINE-GIA-0001');
  });
  it('Header shows the authenticity text when authenticityPolicy is set', () => {
    setProfile(FULL); renderHeader();
    expect(screen.getByTestId('topbar-authenticity')).toHaveTextContent('CHINH-HANG-GIA');
  });
  it('Header hides the authenticity text when authenticityPolicy is missing', () => {
    setProfile(without('authenticityPolicy')); renderHeader();
    expect(screen.queryByTestId('topbar-authenticity')).toBeNull();
    expect(txt()).not.toContain('CHINH-HANG-GIA');
    expect(txt()).not.toContain('chính hãng - Đền');
  });
});

describe('TrustBadges', () => {
  it('TrustBadges shows the authenticity and warranty tiles when set', () => {
    setProfile(FULL); render(<TrustBadges />);
    expect(screen.getByText('CHINH-HANG-GIA')).toBeInTheDocument();
    expect(screen.getByText('BAO-HANH-GIA')).toBeInTheDocument();
  });
  it('TrustBadges hides the authenticity and warranty tiles when missing', () => {
    setProfile(without('authenticityPolicy', 'warrantyPolicy')); render(<TrustBadges />);
    expect(screen.queryByTestId('badge-authenticity')).toBeNull();
    expect(screen.queryByTestId('badge-warranty')).toBeNull();
    expect(screen.queryByText('Cam kết chính hãng')).toBeNull();
    expect(screen.queryByText('Bảo hành')).toBeNull();
    expect(screen.getByText('COD-GIA')).toBeInTheDocument();
  });
  it('TrustBadges shows the COD tile when codPolicy is set', () => {
    setProfile(FULL); render(<TrustBadges />);
    expect(screen.getByText('COD-GIA')).toBeInTheDocument();
  });
  it('TrustBadges hides the COD tile when codPolicy is missing', () => {
    setProfile(without('codPolicy')); render(<TrustBadges />);
    expect(screen.queryByTestId('badge-cod')).toBeNull();
    expect(screen.queryByText('Thanh toán khi nhận hàng')).toBeNull();
  });
  it('TrustBadges shows the store tile when storeNote is set', () => {
    setProfile(FULL); render(<TrustBadges />);
    expect(screen.getByText('CUA-HANG-GIA')).toBeInTheDocument();
  });
  it('TrustBadges hides the store tile when storeNote is missing', () => {
    setProfile(without('storeNote')); render(<TrustBadges />);
    expect(screen.queryByTestId('badge-store')).toBeNull();
    expect(screen.queryByText('Cửa hàng')).toBeNull();
  });
  it('TrustBadges renders nothing when every tile field is missing', () => {
    setProfile(without('authenticityPolicy', 'warrantyPolicy', 'codPolicy', 'storeNote'));
    const { container } = render(<TrustBadges />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TrustSealsPanel', () => {
  it('TrustSealsPanel shows the items that are set', () => {
    setProfile(without('stringWarrantyPolicy')); render(<TrustSealsPanel />);
    expect(screen.getByText('CHINH-HANG-GIA')).toBeInTheDocument();
    expect(screen.queryByTestId('seal-string-warranty')).toBeNull();
    cleanup();
    setProfile(FULL); render(<TrustSealsPanel />);
    expect(screen.getByText('BAO-HANH-LUOI-GIA')).toBeInTheDocument();
  });
  it('TrustSealsPanel hides the authenticity item when only stringWarrantyPolicy is set', () => {
    setProfile(without('authenticityPolicy')); render(<TrustSealsPanel />);
    expect(screen.queryByTestId('seal-authenticity')).toBeNull();
    expect(screen.getByTestId('seal-string-warranty')).toBeInTheDocument();
  });
  it('TrustSealsPanel renders nothing when authenticityPolicy and stringWarrantyPolicy are missing', () => {
    setProfile(without('authenticityPolicy', 'stringWarrantyPolicy'));
    const { container } = render(<TrustSealsPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CartModal', () => {
  const product = {
    id: '1', name: 'Vợt', brand: 'B', image: 'x.jpg', price: 1000, specs: {}, description: '', reviews: [], stock: 5,
    variants: [{ tier_1_option: 'A', tier_2_option: null, sku_code: 'SKU-A', price: 1000, stock: 5 }],
  };
  const item: CartItem = {
    id: 'i1', productId: '1', skuCode: 'SKU-A', name: 'Vợt', brand: 'B', image: 'x.jpg', price: 1000,
    selectedWeight: 'Tiêu chuẩn', selectedColor: 'A', stringOption: null, tension: 10, quantity: 1,
  };
  const mount = () => {
    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: {
        appData: { products: [product], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false, categoriesError: false, productsError: false },
      } as any,
    });
    render(
      <Provider store={store}>
        <CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} />
      </Provider>
    );
  };

  it('CartModal shows the frame warranty note when frameWarrantyPolicy is set', () => {
    setProfile(FULL); mount();
    expect(screen.getByText('BAO-HANH-KHUNG-GIA')).toBeInTheDocument();
  });
  it('CartModal hides the frame warranty note when frameWarrantyPolicy is missing', () => {
    setProfile(without('frameWarrantyPolicy')); mount();
    expect(screen.queryByTestId('frame-warranty-note')).toBeNull();
    expect(txt()).not.toContain('BAO-HANH-KHUNG-GIA');
    expect(txt()).not.toContain('thẻ bảo hành');
  });

  // Đưa CartModal tới màn thành công thật: điền form COD -> gửi OTP (mock) -> OtpModal (mock) xác thực -> tạo đơn (mock).
  async function reachSuccessScreen() {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'KHACH-GIA' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0000000000' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'DIA-CHI-KHACH-GIA' } });
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    fireEvent.click(await screen.findByText('OTP-GIA-XAC-THUC'));
    await screen.findAllByText('ĐẶT HÀNG THÀNH CÔNG', { exact: false });
  }

  it('CartModal shows orderWarrantyNote on the success screen when set', async () => {
    setProfile(FULL);
    await reachSuccessScreen();
    expect(screen.getByText('GHI-CHU-DON-GIA')).toBeInTheDocument();
  });
  it('CartModal hides orderWarrantyNote on the success screen when missing', async () => {
    setProfile(without('orderWarrantyNote'));
    await reachSuccessScreen();
    expect(screen.queryByTestId('order-warranty-note')).toBeNull();
    expect(txt()).not.toContain('GHI-CHU-DON-GIA');
    expect(txt()).not.toContain('chi nhánh');
  });
});

describe('StoreLocator và getBranches', () => {
  // App truyền branches từ store (nạp qua getBranches); ở đây truyền thẳng như App.
  const locator = (branches: typeof FULL.branches = FULL.branches) => render(<StoreLocator branches={branches} products={[]} />);

  it('StoreLocator lists branches from the profile', () => {
    setProfile(FULL); locator();
    expect(screen.getAllByText('CHI-NHANH-GIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SDT-GIA-0002', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('THANH-PHO-GIA').length).toBeGreaterThan(0);
  });
  it('StoreLocator shows the empty state when the profile has no branches', () => {
    setProfile(without('branches')); locator([]);
    expect(document.getElementById('store-locator-empty')).not.toBeNull();
    expect(document.getElementById('store-locator-loading')).toBeNull();
  });
  it('StoreLocator hides the hotline line when hotline is missing', () => {
    const noMap = { ...FULL, hotline: undefined };
    setProfile(noMap); locator();
    expect(txt()).not.toContain('Đường dây nóng');
    cleanup();
    setProfile(FULL); locator();
    expect(txt()).toContain('Đường dây nóng hỗ trợ khách hàng: HOTLINE-GIA-0001');
  });
  it('getBranches returns the profile branches', async () => {
    setProfile(FULL);
    expect(await sportApi.getBranches()).toEqual(FULL.branches);
    vi.unstubAllEnvs();
    expect(await sportApi.getBranches()).toEqual([]);
  });
});
