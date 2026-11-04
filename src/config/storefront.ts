// Mã ngành (code) của cây danh mục VOMA ổn định theo thời gian -- tên hiển thị
// của một ngành (name/display_name) có thể đổi hoặc bị đặt lại bởi người quản
// trị ngành hàng, nhưng mã cây VOMA thì không. Vì vậy "là vợt" được nhận diện
// bằng mã ngành, không so khớp theo tên hiển thị như 'Vợt'.
//
// Cước hiện chưa có ngành VOMA riêng (nằm lẫn trong nhánh "... > Khác") nên
// không có hằng riêng cho cước ở đây -- xem sport-api/index.ts#getStringOptions,
// nơi sản phẩm cước được nhận diện qua thuộc tính `thickness` thật thay vì ngành.
export const RACKET_CATEGORY_CODES: string[] = ['VC001491'];

export function isRacketCategoryCode(categoryCode: string | null | undefined): boolean {
  return Boolean(categoryCode) && RACKET_CATEGORY_CODES.includes(categoryCode as string);
}

// Đường dẫn chung cho lời mời đan cước (thanh dưới menu + cột dịch vụ ở footer):
// đan cước chỉ đặt được cùng vợt, nên dẫn vào ngành vợt.
export const STRINGING_CTA_PATH = `/catalog?category=${RACKET_CATEGORY_CODES[0]}`;

// Menu chính + cột "DANH MỤC CẦU LÔNG" ở footer (bản thiết kế /design/index.html).
// Mục có `codes` chỉ hiện khi VOMA đang có một trong các mã đó (khớp theo MÃ, không
// theo tên). `codes: []` = VOMA chưa có ngành tương ứng nên ẩn; khi VOMA thêm ngành
// thì điền mã vào đây.
export interface MainNavEntry {
  menuLabel: string;
  footerLabel?: string;
  to?: string;
  codes?: string[];
}

export const MAIN_NAV: MainNavEntry[] = [
  { menuLabel: 'BADMINTON (TRANG CHỦ)', to: '/' },
  { menuLabel: 'VỢT CẦU LÔNG', footerLabel: 'Vợt Cầu Lông Yonex / Li-Ning', codes: RACKET_CATEGORY_CODES },
  { menuLabel: 'CƯỚC ĐAN & ĐỘ CĂNG', footerLabel: 'Cước Đan Vợt (Strings)', codes: [] },
  { menuLabel: 'GIÀY CẦU LÔNG', footerLabel: 'Giày Cầu Lông Chuyên Dụng', codes: ['VC001427'] },
  { menuLabel: 'TRANG PHỤC ĐẤU GIẢI', footerLabel: 'Quần Áo & Trang Phục Đấu Giải', codes: [] },
  { menuLabel: 'BAO VỢT & PHỤ KIỆN', footerLabel: 'Bao Vợt & Phụ Kiện', codes: [] }
];

export type VisibleMainNavEntry = MainNavEntry & { to: string };

// Giữ mục có `to`; giữ mục có `codes` chỉ khi một mã nằm trong danh sách ngành đã
// tải, và trỏ link tới mã có mặt đầu tiên.
export function getVisibleMainNav(categories: { code: string }[]): VisibleMainNavEntry[] {
  const loaded = new Set(categories.map(category => category.code));
  return MAIN_NAV.flatMap(entry => {
    if (entry.to) return [{ ...entry, to: entry.to }];
    const code = entry.codes?.find(c => loaded.has(c));
    return code ? [{ ...entry, to: `/catalog?category=${encodeURIComponent(code)}` }] : [];
  });
}

// Gốc canonical duy nhất cho sitemap, robots, api/product và đồng bộ head phía SPA.
export const SITE_ORIGIN = 'https://www.topvnsport.com';

// Liên hệ nhanh (nút nổi Zalo + hotline). Trường nào để trống thì nút tương ứng
// không hiện -- không có giá trị thay thế.
export const CONTACT: { zaloUrl?: string; hotlineDisplay?: string; hotlineTel?: string } = {
  zaloUrl: 'https://zalo.me/955065648695191027',
  hotlineDisplay: '097 6007006',
  hotlineTel: '0976007006'
};
