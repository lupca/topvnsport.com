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
