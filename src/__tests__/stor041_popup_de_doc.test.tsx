import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { popupService, SystemPopupProvider } from '@topvnsport/ui-kit';

// STOR-041: khung thông báo nền đặc như OtpModal (bg-black/60 + thẻ bg-white), không mờ kính,
// tiêu đề có dấu. Mọi popupService.alert/confirm của storefront đi qua đây.
const dialog = () => screen.getByRole('alertdialog');

describe('STOR-041 popup ui-kit dễ đọc', () => {
  afterEach(() => { act(() => { popupService.resolveCurrent(undefined); }); cleanup(); });

  it('alert: nền phủ bg-black/60, không backdrop-blur', async () => {
    render(<SystemPopupProvider><div /></SystemPopupProvider>);
    act(() => { void popupService.alert('Số điện thoại không hợp lệ.'); });
    const overlay = dialog().parentElement!;
    expect(overlay.className).toContain('bg-black/60');
    expect(overlay.className).not.toMatch(/backdrop-blur/);
  });

  it('alert: thẻ nền trắng đặc, tiêu đề "Thông báo", hiện đúng lời', () => {
    render(<SystemPopupProvider><div /></SystemPopupProvider>);
    act(() => { void popupService.alert('Số điện thoại không hợp lệ.'); });
    expect(dialog().className).toContain('bg-white');
    expect(screen.getByRole('heading', { name: 'Thông báo' })).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại không hợp lệ.')).toBeInTheDocument();
  });

  it('confirm: tiêu đề có dấu "Xác nhận"', () => {
    render(<SystemPopupProvider><div /></SystemPopupProvider>);
    act(() => { void popupService.confirm('Xoá món này?'); });
    expect(screen.getByRole('heading', { name: 'Xác nhận' })).toBeInTheDocument();
  });
});
