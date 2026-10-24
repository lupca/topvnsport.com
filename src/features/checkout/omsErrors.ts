// [S1] (D)/[S2] "LỖI CUỐI /payments": 400/404/409 là câu trả lời cuối của OMS; gọi lại chỉ nhận lại đúng lỗi đó.
// Chỉ theo status, không so chuỗi message. Lỗi khác (401/403/429/5xx/mạng/timeout/invalid_response) là lỗi tạm.
export function isFinalPaymentError(err: any): boolean {
  return err?.status === 400 || err?.status === 404 || err?.status === 409;
}

// [S3] "Báo giá 422 địa chỉ người nhận"/[S1] (B) OMS-139: ô nào bị hãng/OMS từ chối. Chỉ theo field_path.
export type ReceiverAddressField = 'receiver_ward_code' | 'receiver_province_code';
export function receiverAddressField(body: any): ReceiverAddressField | null {
  const f = body?.field_path;
  return f === 'receiver_ward_code' || f === 'receiver_province_code' ? f : null;
}
// /orders 422 phải báo giá lại: theo field_path (ô địa chỉ) hoặc theo code ADDRESS_NOT_MAPPED. Không so message.
export const isReceiverAddressError = (body: any): boolean =>
  receiverAddressField(body) !== null || body?.code === 'ADDRESS_NOT_MAPPED';
