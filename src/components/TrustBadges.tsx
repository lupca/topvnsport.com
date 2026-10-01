import React from 'react';
import { ShieldCheck, Trophy, ShoppingBag, MapPin } from 'lucide-react';
import { getSellerProfile } from '../config/sellerProfile';

// STOR-011: mỗi ô là một cam kết của người bán, lấy từ hồ sơ; thiếu trường nào thì không hiện ô đó.
export default function TrustBadges() {
  const { authenticityPolicy, warrantyPolicy, codPolicy, storeNote } = getSellerProfile();
  if (!authenticityPolicy && !warrantyPolicy && !codPolicy && !storeNote) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8" id="trust-badges-ribbon">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {authenticityPolicy && (
          <div data-testid="badge-authenticity" className="space-y-1">
            <ShieldCheck className="w-8 h-8 text-brand-primary mx-auto" />
            <h4 className="font-bold text-gray-900 text-xs uppercase">Cam kết chính hãng</h4>
            <p className="text-[10px] text-gray-500 font-light">{authenticityPolicy}</p>
          </div>
        )}
        {warrantyPolicy && (
          <div data-testid="badge-warranty" className="space-y-1 border-l border-gray-100">
            <Trophy className="w-8 h-8 text-brand-primary mx-auto" />
            <h4 className="font-bold text-gray-900 text-xs uppercase font-display">Bảo hành</h4>
            <p className="text-[10px] text-gray-500 font-light">{warrantyPolicy}</p>
          </div>
        )}
        {codPolicy && (
          <div data-testid="badge-cod" className="space-y-1 border-l border-gray-100">
            <ShoppingBag className="w-8 h-8 text-brand-primary mx-auto" />
            <h4 className="font-bold text-gray-900 text-xs uppercase">Thanh toán khi nhận hàng</h4>
            <p className="text-[10px] text-gray-500 font-light">{codPolicy}</p>
          </div>
        )}
        {storeNote && (
          <div data-testid="badge-store" className="space-y-1 border-l border-gray-100">
            <MapPin className="w-8 h-8 text-brand-primary mx-auto" />
            <h4 className="font-bold text-gray-900 text-xs uppercase font-display">Cửa hàng</h4>
            <p className="text-[10px] text-gray-500 font-light">{storeNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
