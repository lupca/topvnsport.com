import React from 'react';
import { ShieldCheck, Trophy } from 'lucide-react';
import { getSellerProfile } from '../config/sellerProfile';

// STOR-011: hai cam kết lấy từ hồ sơ người bán; thiếu trường nào thì không hiện mục đó.
export default function TrustSealsPanel() {
  const { authenticityPolicy, stringWarrantyPolicy } = getSellerProfile();
  if (!authenticityPolicy && !stringWarrantyPolicy) return null;
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-600">
      {authenticityPolicy && (
        <div data-testid="seal-authenticity" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{authenticityPolicy}</span>
        </div>
      )}
      {stringWarrantyPolicy && (
        <div data-testid="seal-string-warranty" className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-brand-primary shrink-0" />
          <span>{stringWarrantyPolicy}</span>
        </div>
      )}
    </div>
  );
}
