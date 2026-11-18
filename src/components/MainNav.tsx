import React, { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useNavFit } from './useNavFit';
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
  // items chỉ để giữ chỗ (window.__NAV__, chưa tải danh mục): ẩn (visibility) nhưng giữ đúng số hàng của menu.
  placeholder?: boolean;
}

// Gạch chân vẽ trên <span> chữ: dưới md link rộng tối thiểu 44px nhưng gạch vẫn đúng bề rộng chữ (STOR-166).
// -13px = py-[13px] của link, đưa gạch về đáy link. Từ md span không relative nên gạch bám link như cũ.
const ACTIVE_UNDERLINE = 'after:absolute after:inset-x-0 after:bottom-0 max-md:after:bottom-[-13px] after:h-[3px] after:bg-brand-primary';

// Chữ của mọi nhãn menu: link thật, panel và bản đo ẩn dùng CHUNG hằng này, sửa một chỗ thì bản đo không lệch.
const LABEL_TYPE = 'font-display font-extrabold text-sm md:text-[13.5px] leading-[1.5] tracking-[0.03em] uppercase';
const HOME_LABEL = 'BADMINTON (TRANG CHỦ)';
const MORE_LABEL = 'Xem thêm';
// Nút Xem thêm: khoảng cách chữ-mũi tên và cỡ mũi tên cũng nằm trong bề rộng đo.
const MORE_GAP = 'gap-1.5';
const CHEVRON = 'w-4 h-4';
const NAV_GAP = 'gap-[32px]';
const PANEL_MAX_H = 420;
const PANEL_MARGIN = 8;

const linkClass = (active: boolean) =>
  `relative inline-flex items-center max-md:min-w-[44px] max-md:justify-center py-[13px] ${LABEL_TYPE} hover:text-brand-primary ${active ? 'text-brand-primary' : 'text-ink-primary'}`;

// Mục trong panel "Xem thêm": cùng chữ với hàng menu, cao >=44px, mục đang chọn tô màu + vạch trái.
const panelLinkClass = (active: boolean) =>
  `flex items-center min-h-[44px] px-4 py-2 border-l-[3px] ${LABEL_TYPE} hover:bg-brand-light hover:text-brand-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary ${active ? 'text-brand-primary bg-brand-light border-brand-primary' : 'text-ink-primary border-transparent'}`;

// Bản đo ẩn: cùng chữ như link thật; chữ lấy từ data-label (CSS) nên không thêm text/link vào DOM.
const MEASURE_LABEL = `inline-block ${LABEL_TYPE} before:content-[attr(data-label)]`;

const linkLabel = (active: boolean, label: string) => <span className={`max-md:relative ${active ? ACTIVE_UNDERLINE : ''}`}>{label}</span>;

// Nút "Xem thêm" + panel (disclosure: danh sách link, không phải role="menu"). Panel chỉ có trong DOM khi mở nên link ẩn không với tới được bằng Tab.
function MoreMenu({ items, activeCategory, placeholder }: { items: MainNavItem[]; activeCategory: string | null; placeholder: boolean }) {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const focusFirst = useRef(false);
  const panelId = useId();
  const active = items.some(item => item.code === activeCategory);

  useEffect(() => setOpen(false), [pathname, search]);

  // Chiều cao tối đa của panel = chỗ còn lại dưới nút (header dính nên không cuộn trang tới được), tối đa PANEL_MAX_H; danh sách tự cuộn bên trong.
  const [maxH, setMaxH] = useState<number>(PANEL_MAX_H);
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const top = panelRef.current?.getBoundingClientRect().top ?? 0;
      setMaxH(Math.max(0, Math.min(PANEL_MAX_H, window.innerHeight - top - PANEL_MARGIN)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (focusFirst.current) panelRef.current?.querySelector('a')?.focus();
    focusFirst.current = false;
    const away = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  return (
    <li
      ref={wrapRef}
      className={`relative shrink-0 whitespace-nowrap${placeholder ? ' invisible' : ''}`}
      onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); buttonRef.current?.focus(); } }}
      // Focus sang phần tử khác ngoài menu thì đóng; relatedTarget null (bấm chuột) do pointerdown ngoài lo.
      onBlur={e => { if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Xem thêm danh mục"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key !== 'ArrowDown') return;
          e.preventDefault();
          if (open) panelRef.current?.querySelector('a')?.focus();
          else { focusFirst.current = true; setOpen(true); }
        }}
        className={`${linkClass(active)} ${MORE_GAP} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary`}
      >
        {linkLabel(active, MORE_LABEL)}
        <ChevronDown aria-hidden="true" className={`${CHEVRON} motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul ref={panelRef} id={panelId} style={{ maxHeight: maxH }} className="whitespace-normal absolute right-0 top-full z-50 w-max min-w-[220px] max-w-[min(360px,calc(100vw-32px))] overflow-y-auto overscroll-contain bg-white border border-gray-100 rounded-xl shadow-sm py-1">
          {items.map(item => {
            const current = activeCategory === item.code;
            return (
              <li key={item.code}>
                <Link to={`/catalog?category=${encodeURIComponent(item.code)}`} aria-current={current ? 'page' : undefined} onClick={() => setOpen(false)} className={panelLinkClass(current)}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function MainNav({ items, children, placeholder = false }: MainNavProps) {
  const { pathname, search } = useLocation();
  const activeCategory = pathname === '/catalog' ? new URLSearchParams(search).get('category') : null;
  const homeActive = pathname === '/';
  const listRef = useRef<HTMLUListElement>(null);
  const itemCodes = items.map(item => item.code).join('|');
  const { fit, measureRef } = useNavFit(listRef, items.map(item => `${item.code}:${item.label}`).join('|'));
  const shown = fit === null ? items : items.slice(0, fit);
  const hidden = fit === null ? [] : items.slice(fit);

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
      <nav aria-label="Điều hướng chính" className={`${homeActive ? 'hidden md:block ' : ''}relative bg-white border-t border-zinc-200`}>
        <ul ref={listRef} className={`max-w-[1280px] mx-auto px-[24px] flex max-md:flex-nowrap items-center justify-center ${NAV_GAP} max-md:justify-start max-md:overflow-x-auto max-md:gap-6 max-md:px-4`}>
          <li className="max-md:shrink-0 max-md:whitespace-nowrap md:shrink-0 md:whitespace-nowrap">
            <Link to="/" aria-current={homeActive ? 'page' : undefined} className={linkClass(homeActive)}>
              {linkLabel(homeActive, HOME_LABEL)}
            </Link>
          </li>
          {shown.map(item => {
            const active = activeCategory === item.code;
            return (
              <li key={item.code} className={`max-md:shrink-0 max-md:whitespace-nowrap md:shrink-0 md:whitespace-nowrap${placeholder ? ' invisible' : ''}`}>
                <Link
                  to={`/catalog?category=${encodeURIComponent(item.code)}`}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass(active)}
                >
                  {linkLabel(active, item.label)}
                </Link>
              </li>
            );
          })}
          {hidden.length > 0 && <MoreMenu items={hidden} activeCategory={activeCategory} placeholder={placeholder} />}
        </ul>
        {/* Bản đo ẩn (chỉ từ md): cùng chữ/khoảng cách với hàng thật; không có link, không vào cây trợ năng. */}
        <div ref={measureRef} aria-hidden="true" className="hidden md:block absolute inset-x-0 top-0 h-0 overflow-hidden invisible pointer-events-none">
          <div className={`flex w-max ${NAV_GAP} whitespace-nowrap`}>
            {[HOME_LABEL, ...items.map(item => item.label)].map((label, i) => <span key={i} data-label={label} className={MEASURE_LABEL} />)}
            <span className={`inline-flex ${MORE_GAP}`}>
              <span data-label={MORE_LABEL} className={MEASURE_LABEL} />
              <ChevronDown className={CHEVRON} />
            </span>
          </div>
        </div>
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
