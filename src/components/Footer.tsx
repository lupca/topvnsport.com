import React from 'react';
import { Trophy, Phone, MapPin, Mail, ShieldCheck, Heart, Sparkles, Facebook, Youtube, Share2 } from 'lucide-react';

import { Link } from 'react-router-dom';
import { Category, Product } from '../types';
import { getCategoriesSortedByCount, getCategoryLabel } from '../utils/categories';
import { getSellerProfile } from '../config/sellerProfile';

interface FooterProps {
  categories: Category[];
  products: Product[];
}

export default function Footer({ categories, products }: FooterProps) {
  const sortedCategories = getCategoriesSortedByCount(categories, products);
  // STOR-011: mọi lời của người bán lấy từ hồ sơ; thiếu trường nào thì không hiện mục đó.
  const profile = getSellerProfile();
  const hasContact = Boolean(profile.address || profile.hotline || profile.email);

  return (
    <footer className="bg-gray-950 text-gray-400 text-xs md:text-sm border-t border-gray-900 mt-20" id="topvnsport-footer">
      
      {/* Top Banner: core trust value pillars */}
      <div className="bg-gray-900 border-b border-gray-950 py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {profile.authenticityPolicy && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">CAM KẾT CHÍNH HÃNG</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">{profile.authenticityPolicy}</p>
            </div>
          </div>
          )}
          
          {profile.warrantyPolicy && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">BẢO HÀNH</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">{profile.warrantyPolicy}</p>
            </div>
          </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">HỖ TRỢ KỸ THUẬT</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Tư vấn thông số và cách căng lưới đúng kỹ thuật.</p>
            </div>
          </div>

          {profile.headquartersNote && (
          <div data-testid="footer-store-pillar" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">CỬA HÀNG TRẢI NGHIỆM</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">{profile.headquartersNote}</p>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand about block */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-md border border-gray-800 flex items-center justify-center overflow-hidden">
              <img 
                src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                alt="TopVNSport Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display font-black text-xl text-white tracking-tight">TOPVN<span className="text-brand-primary">SPORT</span></span>
          </div>
          {profile.tagline && (
            <p className="text-xs text-gray-500 leading-relaxed">{profile.tagline}</p>
          )}
          <div className="flex items-center gap-3 text-gray-500">
            <Facebook className="w-4 h-4 hover:text-white transition cursor-pointer" />
            <Youtube className="w-4 h-4 hover:text-white transition cursor-pointer" />
            <Share2 className="w-4 h-4 hover:text-white transition cursor-pointer" />
          </div>
        </div>

        {/* Directory links */}
        {sortedCategories.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Sản phẩm cốt lõi</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              {sortedCategories.map(category => (
                <li key={category.id}>
                  <Link to={`/catalog?category=${encodeURIComponent(category.code)}`} className="hover:text-white transition">{getCategoryLabel(category, categories)}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Support links */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">Dịch vụ & Hậu mãi</h4>
          <ul className="space-y-1.5 text-xs">
            <li><Link to="/stores" className="hover:text-white transition">Cửa hàng trải nghiệm trực tiếp</Link></li>
            {profile.warrantyPolicy && <li><button className="hover:text-white transition">Chính sách bảo hành</button></li>}
            <li><button className="hover:text-white transition">Đặt lịch đan cước lấy ngay</button></li>
            <li><Link to="/blog" className="hover:text-white transition">Đánh giá chất lượng sân đấu</Link></li>
            <li><button className="hover:text-white transition">Hướng dẫn chọn vợt theo lực cổ tay</button></li>
          </ul>
        </div>

        {/* Contact address */}
        {hasContact && (
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">Trụ sở & Liên hệ</h4>
          <ul className="space-y-2 text-gray-500">
            {profile.address && (
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
              <span>{profile.address}</span>
            </li>
            )}
            {profile.hotline && (
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-primary shrink-0" />
              <span>{profile.hotline}{profile.hotlineHours ? ` (${profile.hotlineHours})` : ''}</span>
            </li>
            )}
            {profile.email && (
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-primary shrink-0" />
              <span>{profile.email}</span>
            </li>
            )}
          </ul>
        </div>
        )}

      </div>

      {/* Bottom Copyright */}
      <div className="bg-gray-985 border-t border-gray-900/60 py-5 text-center text-xs text-gray-600 px-4">
        <p>© 2026 TopVNSport.{profile.footerSlogan ? ` ${profile.footerSlogan}` : ''}</p>
        {profile.businessLicense && <p data-testid="footer-licence" className="mt-1 text-[10px] text-gray-700">{profile.businessLicense}</p>}
      </div>

    </footer>
  );
}
