import React, { ReactNode, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { STRINGING_CTA_PATH } from '../config/storefront';

export interface MainNavItem {
  code: string;
  label: string;
}

interface MainNavProps {
  // Ngành VOMA còn hàng, đúng thứ tự và nhãn của chip trang chủ (Header truyền vào).
  items: MainNavItem[];
  // Dòng báo lỗi tải danh mục (STOR-057) -- nằm trong <nav>.
  children?: ReactNode;
}

const ACTIVE_UNDERLINE = 'text-brand-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand-primary';

const linkClass = (active: boolean) =>
  `relative inline-flex items-center max-md:min-w-[44px] max-md:justify-center py-[13px] font-display font-extrabold text-sm md:text-[13.5px] leading-[1.5] tracking-[0.03em] uppercase hover:text-brand-primary ${active ? ACTIVE_UNDERLINE : 'text-ink-primary'}`;

export default function MainNav({ items, children }: MainNavProps) {
  const { pathname, search } = useLocation();
  const activeCategory = pathname === '/catalog' ? new URLSearchParams(search).get('category') : null;
  const homeActive = pathname === '/';
  const listRef = useRef<HTMLUListElement>(null);
  const itemCodes = items.map(item => item.code).join('|');

  // Thanh 1 hàng cuộn ngang dưới md: đưa mục đang chọn vào giữa tầm nhìn (STOR-134, MOB-E).
  // Chỉ đổi scrollLeft của <ul>, không cuộn trang; desktop <ul> không tràn nên không đổi gì.
  useEffect(() => {
    const ul = listRef.current;
    const link = ul?.querySelector('[aria-current="page"]');
    if (!ul || !link) return;
    const u = ul.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    ul.scrollLeft += l.left - u.left - (u.width - l.width) / 2;
    // Khoá theo chuỗi mã: Header tạo mảng items mới mỗi lần render, không được kéo lại thanh khi khách đang tự cuộn.
  }, [activeCategory, homeActive, itemCodes]);

  return (
    <>
      <nav aria-label="Điều hướng chính" className={`${homeActive ? 'hidden md:block ' : ''}bg-white border-t border-zinc-200`}>
        <ul ref={listRef} className="max-w-[1280px] mx-auto px-[24px] flex flex-wrap items-center justify-center gap-[32px] max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:gap-6 max-md:px-4">
          <li className="max-md:shrink-0 max-md:whitespace-nowrap">
            <Link to="/" aria-current={homeActive ? 'page' : undefined} className={linkClass(homeActive)}>
              BADMINTON (TRANG CHỦ)
            </Link>
          </li>
          {items.map(item => {
            const active = activeCategory === item.code;
            return (
              <li key={item.code} className="max-md:shrink-0 max-md:whitespace-nowrap">
                <Link
                  to={`/catalog?category=${encodeURIComponent(item.code)}`}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass(active)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {children}
      </nav>

      {/* Dưới md ẩn trên mọi trang để ảnh sản phẩm lên màn đầu (STOR-133, MOB-C); desktop giữ nguyên. */}
      <div data-testid="stringing-strip" className="hidden md:block bg-zinc-100 border-b border-zinc-200 text-center px-[16px] py-[9px] text-[13px] leading-[1.5] font-bold text-ink-primary">
        Dịch vụ Đan Vợt Điện Tử Chuẩn Quốc Tế: Tùy chọn cước &amp; mức căng 9.0kg–13.0kg ngay khi đặt vợt.
        <Link to={STRINGING_CTA_PATH} className="ml-[6px] text-brand-primary underline">Trải nghiệm chọn cước →</Link>
      </div>
    </>
  );
}
