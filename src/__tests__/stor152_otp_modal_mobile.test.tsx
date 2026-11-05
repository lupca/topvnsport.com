// @vitest-environment jsdom
// STOR-152 (goal 2c881ad4, MOB-E 5c6e5961 / MOB-F): below md the OTP modal's tap targets are >=44px (min-h-11 /
// min-w-11 = 2.75rem) and its text >=14px (text-sm), input >=16px (text-lg). Only max-md: tokens, so the classes
// that apply at >=768px stay exactly the pre-STOR-152 list (desktop unchanged).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import OtpModal from '../components/OtpModal';

vi.mock('../services/sportApi', () => ({ sportApi: { sendOtp: vi.fn(), verifyOtp: vi.fn() } }));

// class lists before STOR-152 (static part; the state-dependent tail of the two buttons is not touched)
const DESKTOP = {
  close: 'absolute right-4 top-4 text-gray-400 hover:text-gray-900 transition',
  desc: 'text-xs text-gray-500 mt-1',
  error: 'bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 flex items-start gap-2 text-xs text-left',
  input: 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition',
  resend: 'flex-1 border border-gray-300 font-bold text-xs uppercase py-3 rounded-xl transition',
  submit: 'flex-1 text-white font-bold text-xs uppercase py-3 rounded-xl flex items-center justify-center gap-1.5',
};

function mount() {
  render(<OtpModal isOpen phoneNumber="0900000000" onClose={() => {}} onSuccess={() => {}} />);
  const modal = document.getElementById('otp-verification-modal')!;
  const close = modal.querySelector('button')!;
  const input = screen.getByPlaceholderText('Nhập 6 số OTP');
  // empty code + form submit -> the "nhập đầy đủ" error box renders (no API call)
  fireEvent.submit(input.closest('form')!);
  const els = {
    close,
    desc: modal.querySelector('p')!,
    error: screen.getByText(/Vui lòng nhập đầy đủ mã OTP/).parentElement!,
    input,
    resend: screen.getByRole('button', { name: /Gửi lại/ }),
    submit: screen.getByRole('button', { name: 'Xác nhận OTP' }),
  };
  return { modal, els };
}
const cls = (el: Element) => el.className.split(/\s+/).filter(Boolean);

describe('STOR-152 OtpModal mobile tap targets and text sizes (max-md: only)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it('close X is >=44x44 below md', () => {
    const { els } = mount();
    expect(cls(els.close)).toContain('max-md:min-w-11');
    expect(cls(els.close)).toContain('max-md:min-h-11');
  });
  it('description text is >=14px below md', () => {
    expect(cls(mount().els.desc)).toContain('max-md:text-sm');
  });
  it('error box text is >=14px below md', () => {
    expect(cls(mount().els.error)).toContain('max-md:text-sm');
  });
  it('resend button: text >=14px and >=44px tall below md', () => {
    const { els } = mount();
    expect(cls(els.resend)).toContain('max-md:text-sm');
    expect(cls(els.resend)).toContain('max-md:min-h-11');
  });
  it('submit button: text >=14px and >=44px tall below md', () => {
    const { els } = mount();
    expect(cls(els.submit)).toContain('max-md:text-sm');
    expect(cls(els.submit)).toContain('max-md:min-h-11');
  });
  it('OTP input text stays >=16px (text-lg)', () => {
    expect(cls(mount().els.input)).toContain('text-lg');
  });

  it('desktop (>=md) class lists equal the pre-STOR-152 lists once max-md:* is stripped', () => {
    const { els } = mount();
    for (const [k, want] of Object.entries(DESKTOP)) {
      const got = cls(els[k as keyof typeof els]).filter((c) => !c.startsWith('max-md:'));
      expect(got.slice(0, want.split(' ').length).join(' '), k).toBe(want);
    }
  });

  it('close button stays type=button and the first focusable child of the modal', () => {
    const { modal, els } = mount();
    expect(els.close.getAttribute('type')).toBe('button');
    expect(modal.querySelector('button, input, a, [tabindex]')).toBe(els.close);
  });
});
