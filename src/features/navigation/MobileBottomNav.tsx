import { Home, MapPin, ShoppingBag, Trophy } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';
import { STRINGING_CTA_PATH } from '../../config/storefront';

// STOR-081 / STOR-084: nhãn theo tab Mobile của design (11px đậm, chưa chọn #18181b, viền trên đen 1.5px).
// Giá trị md: giữ nguyên style tính toán cũ ở md+ (thanh này md:hidden) để diff 1440 bằng 0.
const ACTIVE = 'text-brand-primary font-extrabold md:font-bold';
const INACTIVE = 'text-ink-secondary font-bold md:text-gray-400 md:font-normal';
const LABEL = 'text-[11px] md:text-[10px]';

type MobileBottomNavProps = {
  pathname: string;
  navigate: NavigateFunction;
  cartCount: number;
  onOpenCart: () => void;
};

export default function MobileBottomNav({ pathname, navigate, cartCount, onOpenCart }: MobileBottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-[1.5px] border-ink-primary md:border-t md:border-gray-100 flex justify-around items-center py-2 px-2 shadow-sm rounded-t-2xl">
      <button
        onClick={() => navigate('/')}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/' ? ACTIVE : INACTIVE}`}
      >
        <Home className="w-5 h-5" />
        <span className={LABEL}>BADMINTON</span>
      </button>

      <button
        onClick={() => navigate(STRINGING_CTA_PATH)}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/catalog' ? ACTIVE : INACTIVE}`}
      >
        <Trophy className="w-5 h-5" />
        <span className={LABEL}>Vợt &amp; Cước</span>
      </button>

      <button
        onClick={() => navigate('/stores')}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/stores' ? ACTIVE : INACTIVE}`}
      >
        <MapPin className="w-5 h-5" />
        <span className={LABEL}>Đan Vợt O2O</span>
      </button>

      <button
        onClick={onOpenCart}
        className={`flex flex-col items-center gap-1 p-1 ${INACTIVE} hover:text-brand-primary transition relative`}
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 text-gray-500" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </div>
        <span className={LABEL}>Giỏ hàng</span>
      </button>
    </div>
  );
}
