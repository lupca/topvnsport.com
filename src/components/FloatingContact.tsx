import { Phone } from 'lucide-react';
import { CONTACT } from '../config/storefront';
import { contactCallClick, contactZaloClick } from '../lib/tracking';

const BTN = 'h-12 w-12 rounded-full shadow-lg flex items-center justify-center text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2';

// Cụm nút nổi bên phải: Zalo + gọi hotline. Giá trị lấy từ CONTACT; thiếu trường nào thì bỏ nút đó.
export default function FloatingContact({ isPdp }: { isPdp: boolean }) {
  const zaloUrl = CONTACT.zaloUrl?.trim();
  const hotlineDisplay = CONTACT.hotlineDisplay?.trim();
  const hotlineTel = CONTACT.hotlineTel?.trim();
  const showHotline = Boolean(hotlineDisplay && hotlineTel);
  if (!zaloUrl && !showHotline) return null;

  const zaloLabel = 'Chat Zalo với TopVNSport';
  const callLabel = `Gọi hotline ${hotlineDisplay}`;

  return (
    <div className={`${isPdp ? 'floating-contact-pdp' : 'floating-contact'} fixed right-3 md:right-6 z-30 flex flex-col items-end gap-3`}>
      {zaloUrl && (
        <a
          href={zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={zaloLabel}
          title={zaloLabel}
          onClick={contactZaloClick}
          className={`${BTN} bg-[#0068ff] focus-visible:outline-[#0068ff]`}
        >
          <svg viewBox="0 0 48 48" className="w-7 h-7" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M24 6C13.5 6 5 13.6 5 23c0 5.2 2.6 9.8 6.7 12.9-.2 2-.9 4.1-2.4 5.6-.4.4-.1 1.1.5 1 3-.3 5.7-1.4 7.6-2.8C19.7 40.6 21.8 41 24 41c10.5 0 19-7.6 19-17S34.5 6 24 6z"
            />
            <text x="24" y="28.5" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="Arial, sans-serif" fill="#0068ff">Zalo</text>
          </svg>
        </a>
      )}
      {showHotline && (
        <a
          href={`tel:${hotlineTel}`}
          aria-label={callLabel}
          title={callLabel}
          onClick={contactCallClick}
          className={`${BTN} bg-brand-primary focus-visible:outline-brand-primary md:w-auto md:px-4 md:gap-2`}
        >
          <Phone className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span className="hidden md:inline text-sm font-bold whitespace-nowrap">{hotlineDisplay}</span>
        </a>
      )}
    </div>
  );
}
