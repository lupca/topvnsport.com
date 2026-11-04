import React from 'react';
import { Link } from 'react-router-dom';
import { Category, Product } from '../types';
import { getCategoriesSortedByCount } from '../utils/categories';
import { getVisibleMainNav, STRINGING_CTA_PATH } from '../config/storefront';
import TrustBadges from './TrustBadges';

interface FooterProps {
  categories: Category[];
  products: Product[];
}

const HEADING = 'font-display font-extrabold uppercase text-[14px] leading-[1.5] tracking-[0.06em] text-white mb-[14px]';
const TEXT = 'text-[13.5px] leading-[1.8] font-medium text-zinc-200';
const LINK = `${TEXT} hover:text-white hover:underline`;

export default function Footer({ categories, products }: FooterProps) {
  const categoryLinks = getVisibleMainNav(getCategoriesSortedByCount(categories, products)).filter(entry => entry.footerLabel);

  return (
    <footer className="mt-20" id="topvnsport-footer">
      <TrustBadges products={products} />

      <section className="bg-footer-bg text-white px-[24px] pt-[56px] pb-[36px]">
        <div className={`max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-[36px] ${categoryLinks.length > 0 ? 'lg:grid-cols-[1.5fr_1fr_1fr]' : 'lg:grid-cols-[1.5fr_1fr]'}`}>
          <div>
            <h5 className={HEADING}>TOPVNSPORT — BADMINTON SPECIALTY STORE</h5>
            <p className={`${TEXT} mt-[10px]`}><strong>Hotline tư vấn kỹ thuật:</strong> 097 6007006 (08:00 - 22:00)</p>
          </div>

          {categoryLinks.length > 0 && (
            <div>
              <h5 className={HEADING}>DANH MỤC CẦU LÔNG</h5>
              <ul className={TEXT}>
                {categoryLinks.map(entry => (
                  <li key={entry.menuLabel}><Link to={entry.to} className={LINK}>{entry.footerLabel}</Link></li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h5 className={HEADING}>DỊCH VỤ ĐAN VỢT &amp; BẢO HÀNH</h5>
            <ul className={TEXT}>
              <li><Link to={STRINGING_CTA_PATH} className={LINK}>Cấu hình cước đan trực tuyến</Link></li>
              <li><Link to="/stores" className={LINK}>Hệ thống cửa hàng trải nghiệm</Link></li>
            </ul>
          </div>
        </div>
      </section>
    </footer>
  );
}
