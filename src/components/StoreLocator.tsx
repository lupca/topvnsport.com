import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Clock, Calendar, ShieldCheck, CheckCircle2, User, ChevronRight, MessageSquare } from 'lucide-react';
import { Branch, Product } from '../types';
import { popupService } from '@topvnsport/ui-kit';
import { isRacketCategoryCode } from '../config/storefront';

interface StoreLocatorProps {
  branches: Branch[];
  products: Product[];
  initialBranchId?: string;
  onClose?: () => void;
}

export default function StoreLocator({ branches, products, initialBranchId, onClose }: StoreLocatorProps) {
  const [selectedCity, setSelectedCity] = useState<'Tất cả' | 'Hà Nội' | 'TP. Hồ Chí Minh' | 'Đà Nẵng' | 'Hải Dương'>('Tất cả');
  const [activeBranch, setActiveBranch] = useState<Branch>(
    branches.find(b => b.id === initialBranchId) || branches[0]
  );

  // Synchronize state if branches or initialBranchId changes asynchronously
  useEffect(() => {
    if (branches.length > 0) {
      setActiveBranch(prev => prev || branches.find(b => b.id === initialBranchId) || branches[0]);
    }
  }, [branches, initialBranchId]);

  const filteredBranches = selectedCity === 'Tất cả' 
    ? branches 
    : branches.filter(b => b.city === selectedCity);

  if (!activeBranch) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[400px]" id="store-locator-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-300" id="store-locator-page">
      {/* Page Title */}
      <div className="text-center mb-10">
        <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">
          Địa điểm Trải Nghiệm Offline To Online (O2O)
        </span>
        <h1 className="font-display font-black text-2xl md:text-4xl text-gray-900 tracking-tight mt-3">
          CỬA HÀNG TRẢI NGHIỆM <span className="text-brand-primary">TOPVNSPORT</span>
        </h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto mt-2">
          Đến trực tiếp cửa hàng để vung thử, đo đạc thông số tay vợt và sử dụng dịch vụ đan lưới đẳng cấp thế giới.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: List of stores with filters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-xs">
            <h3 className="font-bold text-gray-900 text-sm mb-1">Khu vực phục vụ:</h3>
            <p className="text-xs text-gray-400 mb-3 font-medium">Bản doanh căng cước và thử vợt</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs px-3 py-1.5 rounded-full border bg-brand-primary text-white border-brand-primary font-bold">
                Hà Nội
              </span>
            </div>
          </div>

          {/* Store Cards */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
            {branches.map(branch => (
              <div
                key={branch.id}
                onClick={() => setActiveBranch(branch)}
                className="p-4 rounded-xl border bg-brand-light/70 border-brand-primary shadow-md ring-1 ring-brand-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-brand-primary" />
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{branch.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{branch.address}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-gray-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-brand-primary" /> {branch.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-brand-primary" /> {branch.schedule}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle/Right: Live Map View & Booking Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Branch Map */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
            <div className="bg-gray-950 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] bg-brand-primary text-white px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">ĐANG CHỌN TRẢI NGHIỆM</span>
                <h3 className="font-display font-bold text-base mt-1">{activeBranch.name}</h3>
              </div>
              <a
                href={`tel:${activeBranch.phone}`}
                className="bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition"
              >
                <Phone className="w-3.5 h-3.5" /> Gọi điện: {activeBranch.phone}
              </a>
            </div>

            {/* Embedded maps iframe or beautiful graphics */}
            <div className="aspect-[16/7] w-full bg-gray-100 relative">
              {activeBranch.mapEmbedUrl ? (
                <iframe
                  title={activeBranch.name}
                  src={activeBranch.mapEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-brand-light/30">
                  <MapPin className="w-12 h-12 text-brand-primary mb-2 " />
                  <p className="font-bold text-gray-800 text-sm">Bản đồ số đang đồng bộ định vị...</p>
                  <p className="text-xs text-gray-500 mt-1">Đường dây nóng hỗ trợ khách hàng: 097 6007006</p>
                </div>
              )}
            </div>
          </div>

          {/* Liên hệ chi nhánh: không có API nhận lịch hẹn nên không dựng form; chỉ hiện khi dữ liệu có số điện thoại */}
          {activeBranch.phone?.trim() && (
            <div id="store-locator-contact" className="bg-gray-900 text-white rounded-2xl p-6 md:p-8 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-brand-primary" />
                <h3 className="font-display font-extrabold text-lg text-white">TRẢI NGHIỆM VỢT VÀ ĐAN CƯỚC TẠI {activeBranch.name}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">Gọi điện cho chi nhánh để hẹn thời gian vung thử vợt và đan cước.</p>
              <a
                href={`tel:${activeBranch.phone}`}
                className="inline-flex bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-6 py-3 rounded-full items-center gap-1.5 transition"
              >
                <Phone className="w-3.5 h-3.5" /> {activeBranch.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
