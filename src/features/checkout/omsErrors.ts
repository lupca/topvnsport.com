// [S1] (D)/[S2] "LỖI CUỐI /payments": 400/404/409 là câu trả lời cuối của OMS; gọi lại chỉ nhận lại đúng lỗi đó.
// Chỉ theo status, không so chuỗi message. Lỗi khác (401/403/429/5xx/mạng/timeout/invalid_response) là lỗi tạm.
export function isFinalPaymentError(err: any): boolean {
  return err?.status === 400 || err?.status === 404 || err?.status === 409;
}
