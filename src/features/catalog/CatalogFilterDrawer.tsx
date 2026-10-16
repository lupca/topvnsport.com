import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  resultCount: number;
  onClose: () => void;
  children: ReactNode;
}

// Ngăn kéo bộ lọc cho mobile; chỉ được mount khi đang mở.
export default function CatalogFilterDrawer({ resultCount, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bộ lọc sản phẩm"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-white rounded-t-2xl shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="font-bold text-xs uppercase tracking-wider text-gray-900">Bộ lọc sản phẩm</span>
          <button onClick={onClose} aria-label="Đóng" className="p-1 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
        <div className="p-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full bg-brand-primary text-white font-bold text-xs uppercase tracking-wider py-3 rounded-full">
            Xem {resultCount} sản phẩm
          </button>
        </div>
      </div>
    </div>
  );
}
