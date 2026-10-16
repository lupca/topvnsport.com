import React, { useEffect, useState } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, ShieldCheck, CheckCircle2, Phone, MapPin, Truck, QrCode, CreditCard } from 'lucide-react';
import { StringOption } from '../types';
import { sportApi } from '../services/sportApi';
import { popupService } from '@topvnsport/ui-kit';
import { describeCartItemSkuStatus, getCartItemUnitPrice, isCartItemSkuValid, updateCartItemQuantity, CartItemSkuStatus } from '../features/cart/cartSlice';
import { isStringingTierName } from './product-detail/helpers';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import OtpModal from './OtpModal';


export interface CartItem {
  id: string; // Unique instance id
  productId: string;
  skuCode?: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  selectedWeight: string;
  selectedColor: string;
  // Nhãn phân loại dựng từ tên tầng thật (tier_variations) + giá trị đã chọn,
  // vd "Màu Sắc: DAZZLING BLUE · Size: S". undefined khi sản phẩm không có
  // tầng nào -- UI tự ẩn dòng này thay vì bịa nhãn.
  variantLabel?: string;
  stringOption: StringOption | null;
  tension: number;
  quantity: number;
}

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

const PRODUCTS_LOAD_ERROR_MESSAGE = 'Không tải được danh sách sản phẩm. Vui lòng tải lại trang.';

// Lời người bán cho từng lý do món hàng không hợp lệ -- KHÔNG dùng chung một
// câu cho cả hai ca (sản phẩm bị gỡ khỏi cửa hàng khác với PIM đổi/xoá tổ hợp).
function cartItemWarningMessage(status: CartItemSkuStatus): string | null {
  if (status === 'product_not_found') return 'Sản phẩm này hiện không còn trên cửa hàng. Vui lòng xoá khỏi giỏ.';
  if (status === 'sku_changed') return 'Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.';
  if (status === 'no_price') return 'Phân loại này hiện chưa có giá. Vui lòng xoá và chọn lại.';
  return null;
}

export default function CartModal({ isOpen, onClose, cartItems, onRemoveItem, onClearCart }: CartModalProps) {
  const dispatch = useAppDispatch();
  const products = useAppSelector(state => state.appData.products);
  // Dữ liệu sản phẩm đang tải (danh sách appData.products có thể còn rỗng/
  // thiếu) -- KHÔNG được kết luận "sản phẩm không còn"/"phân loại đã đổi" lúc
  // này, chỉ coi là chưa biết. Nút thanh toán khoá lại tới khi tải xong.
  const isLoadingProducts = useAppSelector(state => state.appData.isLoading);
  // Tải sản phẩm lỗi -> không biết món nào còn bán: báo lỗi tải, khoá thanh toán.
  const productsError = useAppSelector(state => state.appData.productsError);
  const [step, setStep] = useState(1); // 1 = Cart list, 2 = Checkout Form, 3 = Success Screen
  // Ảnh chụp đơn lúc đặt (COD) -- bước 3 đọc từ đây, không đọc giỏ (giỏ đã xoá).
  const [placedOrder, setPlacedOrder] = useState<{ orderNumber: string; shippingAddress: string; total: number | null } | null>(null);
  
  // Checkout Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'fast'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'sepay'>('sepay');
  const [ward, setWard] = useState('');
  const [province, setProvince] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');

  // Đóng giỏ -> lần mở sau về bước 1. Dữ liệu form khách đã nhập giữ nguyên.
  // Đóng ở bước 3 (đơn đã tạo, giỏ đã xoá) thì bỏ luôn ảnh chụp đơn + token OTP.
  useEffect(() => {
    if (isOpen) return;
    if (step === 3) {
      setPlacedOrder(null);
      setVerificationToken('');
    }
    setStep(1);
  }, [isOpen]);

  if (!isOpen) return null;

  // Giá TÍNH LẠI từ biến thể đã tải (không tin item.price lưu localStorage).
  // Đang tải/tải lỗi hoặc biến thể không có giá -> null: không hiện số.
  const lineAmount = (item: CartItem): number | null => {
    if (isLoadingProducts || productsError) return null;
    const unit = getCartItemUnitPrice(item, products);
    return unit === null ? null : unit * item.quantity;
  };
  const lineAmounts = cartItems.map(lineAmount);
  const itemsTotal = lineAmounts.some(a => a === null) ? null : (lineAmounts as number[]).reduce((acc, a) => acc + a, 0);

  const productOf = (item: CartItem) => products.find(p => String(p.id) === String(item.productId));
  const variantStock = (item: CartItem) => productOf(item)?.variants?.find(v => v.sku_code === item.skuCode)?.stock;
  // "Không đan lưới" chỉ có nghĩa với sản phẩm có tầng cước mà phân loại đã chọn không nêu tầng đó.
  const hasUnstrungChoice = (item: CartItem) =>
    (productOf(item)?.tier_variations || []).some(
      tv => isStringingTierName(tv.name) && !(item.variantLabel || '').includes(`${tv.name}:`)
    );

  const shippingCost = shippingMethod === 'standard' ? 30000 : 50000;
  const orderTotal = itemsTotal === null ? null : itemsTotal + shippingCost;
  const formatMoney = (value: number | null) => (value === null ? '' : `${value.toLocaleString('vi-VN')}đ`);

  // Chặn NGAY từ bước 1 -- có món SKU không hợp lệ thì không cho mở bước
  // thanh toán/OTP, thay vì để lọt tới sau sendOtp/findOrCreateCustomer rồi
  // mới báo. Đang tải dữ liệu sản phẩm -> cũng khoá (chưa kết luận được gì).
  const canCheckout = !isLoadingProducts && !productsError && cartItems.every(item => isCartItemSkuValid(item, products));

  const handleCheckoutSubmit = async (e?: React.FormEvent, tokenOverride?: string) => {
    if (e) e.preventDefault();

    // Kiểm SKU của MỌI món hàng TRƯỚC bất kỳ lời gọi API nào (kể cả sendOtp)
    // -- khách không nhận OTP/không bị tạo hồ sơ khách hàng rồi mới bị chặn.
    // Dữ liệu sản phẩm đang tải -> chưa kết luận được gì, không cho thanh
    // toán tiếp (nút "Tiến hành thanh toán" cũng đã khoá ở bước 1).
    if (isLoadingProducts || productsError) {
      return;
    }
    const invalidItem = cartItems.find(item => describeCartItemSkuStatus(item, products) !== 'ok');
    if (invalidItem) {
      const message = cartItemWarningMessage(describeCartItemSkuStatus(invalidItem, products));
      if (message) await popupService.alert(message);
      return;
    }

    if (![fullName, phone, address, ward, province].every(v => v.trim())) {
      await popupService.alert('Vui lòng cung cấp đầy đủ họ tên, số điện thoại, địa chỉ, phường/xã và tỉnh/thành phố nhận hàng.');
      return;
    }

    const activeToken = tokenOverride || verificationToken;

    // Send the initial OTP before opening the verification modal so provider
    // errors (for example, a phone number without Zalo) block checkout here.
    if (!activeToken) {
      setIsSubmitting(true);
      try {
        await sportApi.sendOtp(phone);
        setIsOtpModalOpen(true);
      } catch (err: any) {
        await popupService.alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const shippingAddress = [address, ward, province].map(v => v.trim()).join(', ');
      const customerId = await sportApi.findOrCreateCustomer({
        name: fullName.trim(),
        phone: phone.trim(),
        address: shippingAddress
      });
      const channelId = await sportApi.getOrCreateStorefrontChannelId();

      // Đã kiểm MỌI SKU ngay đầu handleCheckoutSubmit (trước cả sendOtp) --
      // không lặp lại kiểm ở đây.
      const items = cartItems.map(item => {
        return {
          sku_code: item.skuCode!,
          quantity: item.quantity
        };
      });

      // OMS không có trường độ căng riêng -> ghi vào note, mỗi món đan cước một đoạn.
      const stringingNote = cartItems
        .filter(item => item.stringOption)
        .map(item => ` | Đan cước ${item.skuCode}: ${item.stringOption!.name} ${item.tension} Kg`)
        .join('');

      const order = await sportApi.createOrder({
        customer_id: customerId,
        channel_id: channelId,
        items,
        shipping_fee: shippingCost,
        shipping_address: shippingAddress,
        note: `${shippingMethod === 'fast' ? 'Đơn web - Giao hỏa tốc' : 'Đơn web - Giao tiêu chuẩn'} | ${paymentMethod === 'sepay' ? 'SePay QR Code' : 'COD'}${stringingNote}`,
        verification_token: activeToken,
      });

      setPlacedOrder({ orderNumber: order?.order_number || '', shippingAddress, total: orderTotal });

      if (paymentMethod === 'sepay') {
        const checkoutForm = await sportApi.createSepayCheckout(order.id, order.order_number);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = checkoutForm.action;
        for (const [key, value] of Object.entries(checkoutForm.fields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        onClearCart();
        form.submit();
        return;
      }

      // Đơn COD đã tạo trên OMS -> xoá giỏ NGAY (như đường SePay), chống đặt trùng.
      onClearCart();
      setStep(3);
    } catch (err: any) {
      console.error(err);
      if (err.status === 403) {
        await popupService.alert('Mã xác thực OTP đã hết hạn hoặc không hợp lệ. Vui lòng tải lại trang và xác thực lại.');
        setVerificationToken('');
      } else {
        await popupService.alert('Có lỗi xảy ra khi tạo đơn hàng trên OMS. Vui lòng thử lại!');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClearCart();
    setStep(1);
    setPlacedOrder(null);
    setVerificationToken('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end animate-in fade-in duration-200" id="cart-drawer-modal">
      
      {/* Drawer Container */}
      <div className="bg-white w-full max-w-lg h-full flex flex-col justify-between shadow-2xl relative animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-primary" />
            <span className="font-display font-black text-base text-gray-900 uppercase">
              {step === 1 ? 'Giỏ Hàng Của Bạn' : step === 2 ? 'Thanh Toán Đơn Hàng' : 'Đặt Hàng Thành Công'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic step rendering */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {step === 1 && (
            <div className="space-y-4">
              {cartItems.length > 0 ? (
                <>
                  <div className="divide-y divide-gray-100">
                    {cartItems.map((item, index) => {
                      // Dữ liệu sản phẩm đang tải -> chưa kết luận được gì,
                      // không hiện cảnh báo sai lúc danh sách còn rỗng/thiếu.
                      const warningMessage = isLoadingProducts
                        ? null
                        : productsError
                        ? PRODUCTS_LOAD_ERROR_MESSAGE
                        : cartItemWarningMessage(describeCartItemSkuStatus(item, products));
                      return (
                        <div key={item.id} className="py-4 flex gap-3.5">
                          <img src={item.image} alt={item.name} className="w-14 h-14 object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0" referrerPolicy="no-referrer" />
                          <div className="flex-1 space-y-1">
                            <span className="text-[10px] font-mono font-bold text-brand-primary uppercase">{item.brand}</span>
                            <h4 className="font-bold text-xs text-gray-900 line-clamp-1 leading-normal">{item.name}</h4>

                            {/* Selected Specs info -- nhãn phân loại dựng từ tên
                                tầng thật (xem buildVariantLabel), không phải
                                chuỗi cứng "Phiên bản: {weight} | {color}". Sản
                                phẩm không có tầng nào -> không có gì để hiện. */}
                            <div className="text-[10px] text-gray-500 font-mono space-y-0.5">
                              {item.variantLabel && (
                                <p>• Phân loại: <strong className="text-gray-700">{item.variantLabel}</strong></p>
                              )}
                              {item.stringOption ? (
                                <p className="text-brand-primary font-bold">• Đan cước: {item.stringOption.name} ({item.tension} Kg)</p>
                              ) : hasUnstrungChoice(item) ? (
                                <p className="text-gray-400">• Không đan lưới (Mua khung trơn)</p>
                              ) : null}
                            </div>

                            {/* SKU không còn khớp biến thể thật nào của sản
                                phẩm (giỏ hàng cũ, PIM đã đổi/xoá tổ hợp, hoặc
                                sản phẩm không còn trên cửa hàng) -- giữ hiển
                                thị món hàng, không tự xoá, chỉ báo để khách
                                tự xoá/chọn lại. */}
                            {warningMessage && (
                              <p className="text-[10px] text-red-600 font-semibold">{warningMessage}</p>
                            )}

                            <div className="flex justify-between items-center pt-1.5">
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <button
                                  type="button"
                                  aria-label="Giảm số lượng"
                                  disabled={item.quantity <= 1}
                                  onClick={() => dispatch(updateCartItemQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-sm text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <strong className="min-w-4 text-center text-gray-900">{item.quantity}</strong>
                                <button
                                  type="button"
                                  aria-label="Tăng số lượng"
                                  disabled={(() => { const stock = variantStock(item); return typeof stock === 'number' && item.quantity >= stock; })()}
                                  onClick={() => dispatch(updateCartItemQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-sm text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-sm font-bold text-brand-primary font-mono">
                                {formatMoney(lineAmounts[index])}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition h-max"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trust warning */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start gap-2 text-[11px] text-gray-500 leading-normal">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Hóa đơn bán vợt kèm thẻ bảo hành chống gãy sập khung chính hãng.</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500 text-sm">Giỏ hàng của bạn đang trống.</p>
                  <button onClick={onClose} className="text-xs btn-primary px-4 py-2 rounded-sm">
                    Mua Sắm Ngay &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-brand-primary border-b border-gray-100 pb-1.5">Thông tin nhận hàng</h3>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Họ và tên người nhận *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Số điện thoại liên hệ *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ví dụ: 0912345678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Địa chỉ cụ thể (Số nhà, Ngõ/Hẻm, Đường) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Số 12 Chùa Hà"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Phường/Xã *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập phường/xã"
                    value={ward}
                    onChange={e => setWard(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Tỉnh/Thành phố *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tỉnh/thành phố"
                    value={province}
                    onChange={e => setProvince(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Shipping Method */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-brand-primary">Phương thức vận chuyển</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setShippingMethod('standard')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${shippingMethod === 'standard' ? 'bg-brand-light border-brand-primary' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <Truck className="w-4 h-4 text-brand-primary" />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">Giao hàng chuẩn</p>
                      <p className="text-[10px] text-gray-400">3 - 5 ngày • 30.000đ</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setShippingMethod('fast')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${shippingMethod === 'fast' ? 'bg-brand-light border-brand-primary' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <Truck className="w-4 h-4 text-brand-primary " />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">Giao hỏa tốc</p>
                      <p className="text-[10px] text-gray-400">1 - 2 ngày • 50.000đ</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-brand-primary">Phương thức thanh toán</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setPaymentMethod('sepay')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${paymentMethod === 'sepay' ? 'bg-brand-light border-brand-primary' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <QrCode className="w-4 h-4 text-brand-primary shrink-0" />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">SePay QR Code</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Chuyển khoản QR</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${paymentMethod === 'cod' ? 'bg-brand-light border-brand-primary' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <CreditCard className="w-4 h-4 text-brand-primary shrink-0" />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">Thanh toán COD</p>
                      <p className="text-[10px] text-gray-400">Trả khi nhận hàng</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h3 className="font-display font-black text-xl text-gray-900 uppercase">ĐẶT HÀNG THÀNH CÔNG!</h3>
              <p className="text-xs text-gray-500">
                Cảm ơn bạn đã tin tưởng TopVNSport. Hệ thống đang tiến hành đóng gói và chuẩn bị bàn giao cho bưu cục vận chuyển.
              </p>
              
              <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-100 text-xs text-gray-700 space-y-2 font-mono">
                {placedOrder?.orderNumber && <p>• <strong>Mã đơn hàng:</strong> {placedOrder.orderNumber}</p>}
                <p>• <strong>Người nhận:</strong> {fullName}</p>
                <p>• <strong>Số điện thoại:</strong> {phone}</p>
                <p>• <strong>Địa chỉ giao:</strong> {placedOrder?.shippingAddress}</p>
                <p>• <strong>Phương thức giao:</strong> {shippingMethod === 'standard' ? 'Giao hàng chuẩn (COD)' : 'Giao hàng hỏa tốc'}</p>
                <p className="text-sm font-bold text-brand-primary border-t border-gray-200 pt-2 mt-2">
                  Tổng hóa đơn thanh toán: {formatMoney(placedOrder?.total ?? null)}
                </p>
              </div>

              <div className="bg-brand-light p-3 rounded-lg border border-blue-100 text-left text-[11px] text-brand-secondary flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>
                  Đơn hàng của bạn sẽ được bảo hành trực tiếp thông qua số điện thoại mua hàng tại tất cả hơn 80 chi nhánh TopVNSport toàn quốc.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions of drawer */}
        {cartItems.length > 0 && step < 3 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
            <div className="space-y-1.5 text-xs text-gray-600 font-mono">
              <div className="flex justify-between">
                <span>Tổng tiền hàng:</span>
                <strong className="text-gray-900">{formatMoney(itemsTotal)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <strong className="text-gray-900">{shippingCost.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5 font-bold">
                <span className="text-gray-900">Tổng cộng thanh toán:</span>
                <span className="text-brand-primary font-display text-base">{formatMoney(orderTotal)}</span>
              </div>
            </div>

            {step === 1 ? (
              <button
                onClick={() => canCheckout && setStep(2)}
                disabled={!canCheckout}
                className={`w-full text-xs uppercase tracking-wider py-3 rounded-sm flex items-center justify-center gap-1.5 ${
                  canCheckout ? 'btn-primary' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoadingProducts ? 'Đang tải...' : <>Tiến hành thanh toán &rarr;</>}
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={() => setStep(1)}
                  className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-sm transition"
                >
                  Quay lại
                </button>
                <button
                  onClick={() => {
                    void handleCheckoutSubmit();
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-sm flex items-center justify-center gap-1.5 ${isSubmitting ? 'bg-brand-primary/50 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {isSubmitting ? 'Đang xử lý...' : paymentMethod === 'sepay' ? 'Thanh toán SePay QR →' : 'Xác nhận đặt hàng'}
                </button>
              </div>
            )}
          </div>
        )}        {step === 3 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleFinish}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-full transition"
            >
              Hoàn thành mua sắm
            </button>
          </div>
        )}


      </div>
      <OtpModal
        isOpen={isOtpModalOpen}
        phoneNumber={phone}
        onClose={() => setIsOtpModalOpen(false)}
        onSuccess={(token) => {
          setIsOtpModalOpen(false);
          setVerificationToken(token);
          void handleCheckoutSubmit(undefined, token);
        }}
      />
    </div>
  );
}
