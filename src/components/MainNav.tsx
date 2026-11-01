import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getVisibleMainNav, STRINGING_CTA_PATH } from '../config/storefront';

interface MainNavProps {
  categories: { code: string }[];
  // Dòng báo lỗi tải danh mục (STOR-057) -- nằm trong <nav>.
  children?: ReactNode;
}

const ACTIVE_UNDERLINE = 'text-brand-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand-primary';

export default function MainNav({ categories, children }: MainNavProps) {
  const { pathname, search } = useLocation();
  const activeCategory = pathname === '/catalog' ? new URLSearchParams(search).get('category') : null;

  return (
    <>
      <nav aria-label="Điều hướng chính" className="bg-white border-t border-zinc-200">
        <ul className="max-w-[1280px] mx-auto px-[24px] flex flex-wrap items-center justify-center gap-[32px]">
          {getVisibleMainNav(categories).map(entry => {
            const active = entry.codes ? entry.codes.includes(activeCategory ?? '') : pathname === entry.to;
            return (
              <li key={entry.menuLabel}>
                <Link
                  to={entry.to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center py-[13px] font-display font-extrabold text-[13.5px] leading-[1.5] tracking-[0.03em] uppercase hover:text-brand-primary ${active ? ACTIVE_UNDERLINE : 'text-ink-primary'}`}
                >
                  {entry.menuLabel}
                </Link>
              </li>
            );
          })}
        </ul>
        {children}
      </nav>

      <div data-testid="stringing-strip" className="bg-zinc-100 border-b border-zinc-200 text-center px-[16px] py-[9px] text-[13px] leading-[1.5] font-bold text-ink-primary">
        Dịch vụ Đan Vợt Điện Tử Chuẩn Quốc Tế: Tùy chọn cước &amp; mức căng 9.0kg–13.0kg ngay khi đặt vợt.
        <Link to={STRINGING_CTA_PATH} className="ml-[6px] text-brand-primary underline">Trải nghiệm chọn cước →</Link>
      </div>
    </>
  );
}
