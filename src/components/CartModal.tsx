import React, { useEffect, useRef, useState } from 'react';
import { isValidPhone, isPhoneComplete, normalizePhone, PHONE_ERROR_MESSAGE } from '../utils/phone';
import { X, Minus, Plus, Trash2, ShoppingBag, ShieldCheck, CheckCircle2, Phone, MapPin, Truck, QrCode, CreditCard } from 'lucide-react';
import { StringOption } from '../types';
import { sportApi } from '../services/sportApi';
import { popupService } from '@topvnsport/ui-kit';
import { cartItemWarningMessage, describeCartItemSkuStatus, getCartItemUnitPrice, isCartItemSkuValid, updateCartItemQuantity } from '../features/cart/cartSlice';
import { isStringingTierName } from './product-detail/helpers';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import OtpModal, { getStoredCooldown, markOtpSent } from './OtpModal';
import AdminUnitPicker from './AdminUnitPicker';
import { AdminUnit, DeliveryOption, ShippingQuote, ShippingQuoteOption } from '../services/sport-api/types';


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

const PROVINCES_LOAD_ERROR_MESSAGE = 'Không tải được danh sách tỉnh/thành phố.';
const WARDS_LOAD_ERROR_MESSAGE = 'Không tải được danh sách phường/xã.';

// Lời lỗi OMS (top-level message) nguyên văn; không có -> câu cố định.
function adminUnitsErrorMessage(err: any, fixed: string): string {
  return typeof err?.body?.message === 'string' ? err.body.message : fixed;
}

// Lời lỗi cho khách: err.message (sportApi), rồi chuỗi trong body, rồi câu cố định.
function errorText(err: any, fixed: string): string {
  // sportApi đã chọn sẵn câu hiển thị được (lời OMS đáng tin hoặc câu tiếng Việt cố định) -> err.message trước.
  const b = err?.body;
  const candidates = [err?.message, typeof b === 'string' ? b : null, b?.message, b?.detail];
  const found = candidates.find((c): c is string => typeof c === 'string' && c.trim() !== '');
  return found ?? fixed;
}

// POST /orders lỗi mà không biết OMS đã tạo đơn chưa: mất kết nối, hết giờ, 5xx, phản hồi hỏng.
function isOutcomeUnknown(err: any): boolean {
  if (err?.kind === 'network' || err?.kind === 'timeout' || err?.kind === 'invalid_response') return true;
  return typeof err?.status !== 'number' || err.status >= 500;
}

const UNCERTAIN_ORDER_MESSAGE = 'Chưa chắc đơn đã được tạo vì kết nối tới cửa hàng bị gián đoạn. Xin đừng đặt lại ngay: hãy kiểm tra tin nhắn/email xác nhận đơn hoặc liên hệ cửa hàng để hỏi đơn theo số điện thoại đã nhập, rồi mới đặt lại nếu chưa có đơn.';
const MISSING_ORDER_NUMBER_MESSAGE = 'Chưa chắc đơn đã được tạo: hệ thống phản hồi nhưng không trả về mã đơn hàng. Xin đừng đặt lại ngay: hãy kiểm tra tin nhắn/email xác nhận đơn hoặc liên hệ cửa hàng để hỏi đơn theo số điện thoại đã nhập.';
const ORDER_FAILED_MESSAGE = 'Chưa tạo được đơn hàng. Vui lòng thử lại!';
const TOKEN_REJECTED_MESSAGE = 'Mã xác thực OTP đã hết hạn hoặc không hợp lệ. Vui lòng xác thực lại số điện thoại.';
const PAYMENT_OPEN_FAILED_MESSAGE = 'Cổng thanh toán chưa phản hồi. Vui lòng bấm "Thanh toán lại".';

type PlacedOrder = { orderNumber: string; shippingAddress: string; total: number | null; shippingFee: number | null; adjusted: boolean; method: 'cod' | 'sepay' };

// Đơn SePay đã tạo mà chưa mở được trang thanh toán: nhớ để đóng/mở lại giỏ vẫn còn nút 'Thanh toán lại'.
const PENDING_KEY = 'pending_sepay_order';
function readPending(): { order: PlacedOrder; error: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    return v && typeof v.order?.orderNumber === 'string' && v.order.orderNumber && typeof v.error === 'string' ? v : null;
  } catch { return null; }
}
function writePending(order: PlacedOrder, error: string) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ order, error })); } catch { /* sessionStorage bị chặn: chỉ mất khả năng khôi phục */ }
}
function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* như trên */ }
}

type UnitList = { units: AdminUnit[] | null; loading: boolean; error: string | null };
const EMPTY_LIST: UnitList = { units: null, loading: false, error: null };

const QUOTE_FAILED_MESSAGE = 'Chưa tính được phí vận chuyển. Vui lòng thử lại.';
const QUOTE_REJECTED_MESSAGE = 'Không tính được phí vận chuyển cho giỏ hàng và địa chỉ này.';
const ORDER_REJECTED_MESSAGE = 'Đơn hàng chưa được chấp nhận. Vui lòng kiểm tra lại thông tin rồi thử lại.';
const TOTAL_MISSING_MESSAGE = 'Chưa nhận được tổng tiền từ hệ thống — cửa hàng sẽ xác nhận lại với bạn.';
const FEE_MISSING_MESSAGE = 'Chưa nhận được phí vận chuyển từ hệ thống — cửa hàng sẽ xác nhận lại với bạn.';
const NO_DELIVERY_MESSAGE = 'Địa chỉ này hiện chưa có phương thức giao hàng nào. Vui lòng chọn địa chỉ khác.';

// Báo giá của OMS cho đúng một bộ giỏ+xã (key).
type QuoteState = { key: string; status: 'loading' | 'ok' | 'error'; data?: ShippingQuote; message?: string; retryable?: boolean };

const DELIVERY_OPTIONS: { value: DeliveryOption; label: string }[] = [
  { value: 'STANDARD', label: 'Giao hàng chuẩn' },
  { value: 'EXPRESS', label: 'Giao hỏa tốc' },
];
// Option dùng được = OMS báo available và có phí là số.
const isUsable = (o: ShippingQuoteOption | undefined): o is ShippingQuoteOption =>
  !!o && o.available === true && typeof o.shipping_fee === 'number';

const PRODUCTS_LOAD_ERROR_MESSAGE = 'Không tải được danh sách sản phẩm. Vui lòng tải lại trang.';

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
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  // SePay: đơn đã tạo nhưng chưa mở được trang thanh toán (null = chưa lỗi).
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  // Đặt đơn lỗi mà chưa biết đơn đã tạo chưa: khoá nút tới khi khách xác nhận đã kiểm tra.
  const [orderUncertain, setOrderUncertain] = useState<string | null>(null);
  
  // Checkout Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'sepay'>('sepay');
  // Tỉnh/xã chọn từ danh mục OMS; mã giữ trong state để STOR-037 gửi cùng delivery_option.
  const [province, setProvince] = useState<AdminUnit | null>(null);
  const [ward, setWard] = useState<AdminUnit | null>(null);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [wardQuery, setWardQuery] = useState('');
  const [provinces, setProvinces] = useState<UnitList>(EMPTY_LIST);
  const [wards, setWards] = useState<UnitList>(EMPTY_LIST);
  const provincesInFlight = useRef(false);
  const wardsParent = useRef<string | null>(null);
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const quoteKeyRef = useRef<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  // Một báo giá cho mỗi bộ (giỏ, tỉnh, xã). null = chưa chọn xã.
  const quoteKey = province && ward
    ? JSON.stringify([cartItems.map(i => [i.skuCode, i.quantity]), province.code, ward.code])
    : null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneNormalized = normalizePhone(phone);
  const phoneValid = isValidPhone(phone);
  // Đã nhập mà sai thì khoá nút; còn trống thì để guard 'thiếu thông tin' báo bằng lời.
  const phoneBlocked = phone.trim() !== '' && !phoneValid;
  const showPhoneError = phone.trim() !== '' && !phoneValid && (phoneTouched || isPhoneComplete(phone));
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  // Sau 403 token mà vừa gửi OTP < 60s: modal mở ở trạng thái chờ gửi lại, không nhận mã cũ.
  const [otpNeedsResend, setOtpNeedsResend] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');

  // Đóng giỏ -> lần mở sau về bước 1. Dữ liệu form khách đã nhập giữ nguyên.
  // Đóng ở bước 3 (đơn đã tạo, giỏ đã xoá) thì bỏ luôn ảnh chụp đơn + token OTP.
  useEffect(() => {
    if (isOpen) return;
    if (step === 3) {
      setPlacedOrder(null);
      setPaymentError(null);
      setVerificationToken('');
    }
    setStep(1);
  }, [isOpen]);

  // Mở lại giỏ khi còn đơn SePay chờ thanh toán -> hiện lại màn 'Thanh toán lại'.
  useEffect(() => {
    if (!isOpen || placedOrder) return;
    const pending = readPending();
    if (pending) {
      setPlacedOrder(pending.order);
      setPaymentError(pending.error);
      setStep(3);
    }
  }, [isOpen]);

  const loadProvinces = async () => {
    if (provincesInFlight.current) return;
    provincesInFlight.current = true;
    setProvinces({ units: null, loading: true, error: null });
    try {
      setProvinces({ units: await sportApi.getAdminUnits('province'), loading: false, error: null });
    } catch (err: any) {
      setProvinces({ units: null, loading: false, error: adminUnitsErrorMessage(err, PROVINCES_LOAD_ERROR_MESSAGE) });
    } finally {
      provincesInFlight.current = false;
    }
  };

  const loadWards = async (provinceCode: string) => {
    wardsParent.current = provinceCode;
    setWards({ units: null, loading: true, error: null });
    try {
      const units = await sportApi.getAdminUnits('ward', provinceCode);
      if (wardsParent.current === provinceCode) setWards({ units, loading: false, error: null });
    } catch (err: any) {
      if (wardsParent.current === provinceCode) {
        setWards({ units: null, loading: false, error: adminUnitsErrorMessage(err, WARDS_LOAD_ERROR_MESSAGE) });
      }
    }
  };

  // Mở bước 2 mà chưa có danh sách tỉnh -> tải. Lỗi thì dừng, chờ khách bấm "Thử lại".
  useEffect(() => {
    if (isOpen && step === 2 && !provinces.units && !provinces.loading && !provinces.error) void loadProvinces();
  }, [isOpen, step, provinces]);

  // Bước 2 + đã chọn xã + bộ giỏ/xã chưa báo giá -> hỏi OMS (delivery_option null = lấy cả hai).
  // Kết quả về muộn của bộ cũ bị bỏ (so với quoteKeyRef). Lỗi: dừng, chờ khách bấm "Thử lại".
  useEffect(() => {
    if (!isOpen || step !== 2 || !quoteKey || !province || !ward) return;
    if (quoteKeyRef.current === quoteKey) return;
    quoteKeyRef.current = quoteKey;
    setQuote({ key: quoteKey, status: 'loading' });
    sportApi.getShippingQuote({
      items: cartItems.map(i => ({ sku_code: i.skuCode!, quantity: i.quantity })),
      receiver_province_code: province.code,
      receiver_ward_code: ward.code,
      delivery_option: null,
    }).then(data => {
      if (quoteKeyRef.current !== quoteKey) return;
      setQuote({ key: quoteKey, status: 'ok', data });
      // Option đang chọn không dùng được nữa -> chuyển sang option còn dùng được.
      setDeliveryOption(cur => {
        const byOpt = (v: DeliveryOption) => data.options.find(o => o.delivery_option === v);
        if (isUsable(byOpt(cur))) return cur;
        return DELIVERY_OPTIONS.find(d => isUsable(byOpt(d.value)))?.value ?? cur;
      });
    }).catch((err: any) => {
      if (quoteKeyRef.current !== quoteKey) return;
      const message = typeof err?.body?.message === 'string' && err.body.message.trim()
        ? err.body.message
        : err?.status === 422 ? QUOTE_REJECTED_MESSAGE : QUOTE_FAILED_MESSAGE;
      setQuote({ key: quoteKey, status: 'error', message, retryable: err?.status !== 422 });
    });
  }, [isOpen, step, quoteKey, retryTick]);

  const retryQuote = () => {
    quoteKeyRef.current = null;
    setRetryTick(t => t + 1);
  };

  // Đổi tỉnh (chọn tỉnh khác hoặc gõ lại) -> xoá xã đã chọn và chữ tìm xã.
  const handleProvinceChange = (unit: AdminUnit | null) => {
    setProvince(unit);
    setWard(null);
    setWardQuery('');
    if (unit) {
      void loadWards(unit.code);
    } else {
      wardsParent.current = null;
      setWards(EMPTY_LIST);
    }
  };

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

  // Chỉ dùng báo giá của ĐÚNG bộ giỏ+xã hiện tại; không có giá dùng được -> null (không đoán phí).
  const currentQuote = quote && quote.key === quoteKey ? quote : null;
  const quoteOptions = currentQuote?.status === 'ok' ? currentQuote.data!.options : null;
  const selectedOption = quoteOptions?.find(o => o.delivery_option === deliveryOption);
  const selectedFee: number | null = isUsable(selectedOption) ? selectedOption.shipping_fee : null;
  // Chưa có giá thì nói đúng lý do (không dùng chung một câu cho mọi ca).
  const shippingFeePlaceholder = currentQuote?.status === 'loading' ? 'Đang tính phí...'
    : currentQuote?.status === 'error' ? 'Chưa tính được phí'
    : quoteOptions && !quoteOptions.some(isUsable) ? 'Không có phương thức giao'
    : 'Chọn địa chỉ để tính phí';
  const orderTotal = itemsTotal === null || selectedFee === null ? null : itemsTotal + selectedFee;
  const formatMoney = (value: number | null) => (value === null ? '' : `${value.toLocaleString('vi-VN')}đ`);

  // Chặn NGAY từ bước 1 -- có món SKU không hợp lệ thì không cho mở bước
  // thanh toán/OTP, thay vì để lọt tới sau sendOtp rồi
  // mới báo. Đang tải dữ liệu sản phẩm -> cũng khoá (chưa kết luận được gì).
  const canCheckout = !isLoadingProducts && !productsError && cartItems.every(item => isCartItemSkuValid(item, products));

  const handleCheckoutSubmit = async (e?: React.FormEvent, tokenOverride?: string) => {
    if (e) e.preventDefault();
    if (orderUncertain || isSubmitting) return;

    // Kiểm SKU của MỌI món hàng TRƯỚC bất kỳ lời gọi API nào (kể cả sendOtp)
    // -- khách không nhận OTP/không bị tạo hồ sơ khách hàng rồi mới bị chặn.
    // Dữ liệu sản phẩm đang tải -> chưa kết luận được gì, không cho thanh
    // toán tiếp (nút "Tiến hành thanh toán" cũng đã khoá ở bước 1).
    if (isLoadingProducts || productsError) {
      return;
    }
    const invalidItem = cartItems.find(item => describeCartItemSkuStatus(item, products) !== 'ok');
    if (invalidItem) {
      const message = cartItemWarningMessage(describeCartItemSkuStatus(invalidItem, products), variantStock(invalidItem));
      if (message) await popupService.alert(message);
      return;
    }

    if (![fullName, phone, address].every(v => v.trim())) {
      await popupService.alert('Vui lòng cung cấp đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.');
      return;
    }
    if (!province?.code || !ward?.code) {
      await popupService.alert('Vui lòng chọn tỉnh/thành phố và phường/xã nhận hàng từ danh sách.');
      return;
    }
    if (selectedFee === null) return;

    if (!phoneValid) {
      setPhoneTouched(true);
      return;
    }

    const activeToken = tokenOverride || verificationToken;

    // Send the initial OTP before opening the verification modal so provider
    // errors (for example, a phone number without Zalo) block checkout here.
    if (!activeToken) {
      // Vừa gửi OTP cho số này (chưa quá 60s): mở lại modal, không gửi thêm (send-otp sẽ 429).
      if (getStoredCooldown(phoneNormalized) > 0) {
        setIsOtpModalOpen(true);
        return;
      }
      setIsSubmitting(true);
      try {
        await sportApi.sendOtp(phoneNormalized);
        markOtpSent(phoneNormalized);
        setOtpNeedsResend(false);
        setIsOtpModalOpen(true);
      } catch (err: any) {
        await popupService.alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const clientTotal = orderTotal; // tổng khách đã thấy lúc bấm đặt
    setIsSubmitting(true);
    const shippingAddress = [address.trim(), ward.name, province.name].join(', ');
    let order: any;
    try {
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

      order = await sportApi.createOrder({
        customer: { name: fullName.trim(), phone: phoneNormalized, address: shippingAddress },
        items,
        shipping_fee: selectedFee,
        shipping_address: shippingAddress,
        note: `${paymentMethod === 'sepay' ? 'SePay QR Code' : 'COD'}${stringingNote}`,
        verification_token: activeToken,
        receiver_province_code: province.code,
        receiver_ward_code: ward.code,
        delivery_option: deliveryOption,
        payment_method: paymentMethod === 'cod' ? 'COD' : 'SEPAY',
      });
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
      if (err.status === 403) {
        setVerificationToken('');
        const wait = getStoredCooldown(phoneNormalized);
        if (wait > 0) {
          // Vừa gửi OTP: không gửi lại được ngay. Mở modal chờ, không cho xác nhận mã đã dùng.
          setOtpNeedsResend(true);
          setIsOtpModalOpen(true);
          await popupService.alert(`Mã xác thực đã hết hạn. Bạn có thể nhận mã mới sau ${wait} giây.`);
        } else {
          await popupService.alert(errorText(err, TOKEN_REJECTED_MESSAGE));
        }
      } else if (err.status === 422) {
        // Lỗi nghiệp vụ/schema của (C): hiện lời OMS, ở lại bước 2, giữ giỏ + token OTP.
        const body = err.body;
        const omsMessage = typeof body?.message === 'string' && body.message.trim()
          ? body.message
          : typeof body?.detail?.[0]?.msg === 'string' && body.detail[0].msg.trim() ? body.detail[0].msg : null;
        await popupService.alert(omsMessage ?? ORDER_REJECTED_MESSAGE);
        if (body?.code === 'DELIVERY_OPTION_UNAVAILABLE') retryQuote();
      } else if (isOutcomeUnknown(err)) {
        setOrderUncertain(UNCERTAIN_ORDER_MESSAGE);
        await popupService.alert(UNCERTAIN_ORDER_MESSAGE);
      } else {
        await popupService.alert(errorText(err, ORDER_FAILED_MESSAGE));
      }
      return;
    }
    setIsSubmitting(false);

    if (!order?.order_number) {
      // 201 không có mã đơn: không sang bước thành công, không gọi thanh toán.
      console.error('OMS 201 thiếu order_number', order);
      setOrderUncertain(MISSING_ORDER_NUMBER_MESSAGE);
      await popupService.alert(MISSING_ORDER_NUMBER_MESSAGE);
      return;
    }

    // Số của OMS (201) thắng số client; không hữu hạn -> null (không hiện số tự tính).
    const serverNumber = (v: unknown): number | null => {
      const n = Number(v);
      if (v === null || v === undefined || v === '' || !Number.isFinite(n)) {
        console.error('OMS 201 có số tiền không hợp lệ', v);
        return null;
      }
      return n;
    };
    const serverTotal = serverNumber(order.total_amount);
    const placed: PlacedOrder = {
      orderNumber: order.order_number,
      shippingAddress,
      total: serverTotal,
      shippingFee: serverNumber(order.shipping_fee),
      adjusted: serverTotal !== null && serverTotal !== clientTotal,
      method: paymentMethod,
    };
    setPlacedOrder(placed);

    // Đơn đã tạo trên OMS -> xoá giỏ NGAY, chống đặt trùng (kể cả khi bước thanh toán lỗi).
    onClearCart();
    setStep(3);
    if (paymentMethod === 'sepay') await openSepay(placed);
  };

  // Chỉ gọi /payments với mã đơn đã có -- không bao giờ tạo đơn lại.
  const openSepay = async (placed: PlacedOrder) => {
    setIsPaying(true);
    setPaymentError(null);
    try {
      const checkoutForm = await sportApi.createSepayCheckout(placed.orderNumber);
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
      form.submit();
      clearPending(); // đã chuyển sang cổng thanh toán
    } catch (err: any) {
      console.error(err);
      const message = errorText(err, PAYMENT_OPEN_FAILED_MESSAGE);
      setPaymentError(message);
      writePending(placed, message);
    } finally {
      setIsPaying(false);
    }
  };

  const handleFinish = () => {
    clearPending(); // khách chủ động kết thúc: bỏ đơn chờ thanh toán đã nhớ
    onClearCart();
    setStep(1);
    setPlacedOrder(null);
    setPaymentError(null);
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
              {step === 1 ? 'Giỏ Hàng Của Bạn' : step === 2 || placedOrder?.method === 'sepay' ? 'Thanh Toán Đơn Hàng' : 'Đặt Hàng Thành Công'}
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
                        : cartItemWarningMessage(describeCartItemSkuStatus(item, products), variantStock(item));
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
            <form id="checkout-form" noValidate onSubmit={handleCheckoutSubmit} className="space-y-4">
              {orderUncertain && (
                <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-3 rounded-lg space-y-2">
                  <p>{orderUncertain}</p>
                  <button type="button" onClick={() => setOrderUncertain(null)} className="underline font-bold">
                    Tôi đã kiểm tra, chưa có đơn — cho phép đặt lại
                  </button>
                </div>
              )}
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
                    inputMode="tel"
                    required
                    placeholder="Ví dụ: 0912345678"
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      // Token OTP gắn với số đã xác thực; đổi số thì phải xác thực lại.
                      if (verificationToken && normalizePhone(e.target.value) !== phoneNormalized) setVerificationToken('');
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    aria-invalid={showPhoneError}
                    className={`w-full bg-gray-50 border ${showPhoneError ? 'border-red-500' : 'border-gray-200'} rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition`}
                  />
                  {showPhoneError && <p role="alert" className="text-[11px] text-red-600">{PHONE_ERROR_MESSAGE}</p>}
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

                <AdminUnitPicker
                  label="Tỉnh/Thành phố"
                  placeholder="Chọn tỉnh/thành phố"
                  units={provinces.units}
                  value={province}
                  query={provinceQuery}
                  onQueryChange={setProvinceQuery}
                  onChange={handleProvinceChange}
                  loading={provinces.loading}
                  error={provinces.error}
                  onRetry={() => void loadProvinces()}
                />

                <AdminUnitPicker
                  label="Phường/Xã"
                  placeholder={province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố trước'}
                  units={wards.units}
                  value={ward}
                  query={wardQuery}
                  onQueryChange={setWardQuery}
                  onChange={setWard}
                  loading={wards.loading}
                  error={wards.error}
                  onRetry={() => province && void loadWards(province.code)}
                  disabled={!province}
                />
              </div>

              {/* Shipping Method */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-brand-primary">Phương thức vận chuyển</h3>
                {!currentQuote && <p className="text-[11px] text-gray-400">Chọn tỉnh/thành phố và phường/xã để xem phí giao hàng.</p>}
                {currentQuote?.status === 'loading' && <p className="text-[11px] text-gray-400">Đang lấy báo giá vận chuyển...</p>}
                {currentQuote?.status === 'error' && (
                  <div role="alert" className="text-[11px] text-red-600 font-semibold space-y-1.5">
                    <p>{currentQuote.message}</p>
                    {currentQuote.retryable && (
                      <button type="button" onClick={retryQuote} className="underline text-brand-primary">Thử lại</button>
                    )}
                  </div>
                )}
                {quoteOptions && !quoteOptions.some(isUsable) && (
                  <p role="alert" className="text-[11px] text-red-600 font-semibold">{NO_DELIVERY_MESSAGE}</p>
                )}
                {quoteOptions && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {DELIVERY_OPTIONS.map(({ value, label }) => {
                      const opt = quoteOptions.find(o => o.delivery_option === value);
                      if (!opt) return null;
                      const usable = isUsable(opt);
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!usable}
                          aria-disabled={!usable}
                          onClick={() => usable && setDeliveryOption(value)}
                          className={`p-3 rounded-lg border text-left transition flex items-center gap-2 ${!usable ? 'bg-gray-50 border-gray-100 opacity-70 cursor-not-allowed' : deliveryOption === value ? 'bg-brand-light border-brand-primary cursor-pointer' : 'bg-white border-gray-150 hover:border-gray-200 cursor-pointer'}`}
                        >
                          <Truck className="w-4 h-4 text-brand-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-[11px] text-gray-900">{label}</p>
                            {usable ? (
                              <p className="text-[10px] text-gray-400">
                                {opt.eta_days !== null && <>Dự kiến {opt.eta_days} ngày • </>}{formatMoney(opt.shipping_fee)}
                                {opt.is_fallback && <span className="block text-amber-600 font-semibold">Phí tạm tính</span>}
                              </p>
                            ) : (
                              <p className="text-[10px] text-red-600">{opt.unavailable_reason}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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

          {step === 3 && placedOrder?.method === 'sepay' && (
            <div className="text-center py-8 space-y-4">
              {paymentError ? (
                <>
                  <h3 className="font-display font-black text-lg text-gray-900 uppercase">Chưa mở được trang thanh toán</h3>
                  <p role="alert" className="text-xs text-red-600 font-semibold">
                    Đã tạo đơn {placedOrder.orderNumber}. Chưa mở được trang thanh toán: {paymentError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void openSepay(placedOrder)}
                    disabled={isPaying}
                    className={`w-full text-white font-bold text-xs uppercase tracking-wider py-3 rounded-sm ${isPaying ? 'bg-brand-primary/50 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {isPaying ? 'Đang xử lý...' : 'Thanh toán lại'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500">Đã tạo đơn {placedOrder.orderNumber}. Đang chuyển tới trang thanh toán SePay...</p>
              )}
            </div>
          )}

          {step === 3 && placedOrder?.method !== 'sepay' && (
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
                <p>• <strong>Phương thức giao:</strong> {deliveryOption === 'STANDARD' ? 'Giao hàng chuẩn (COD)' : 'Giao hàng hỏa tốc'}</p>
                {placedOrder && <p>• <strong>Phí vận chuyển:</strong> {placedOrder.shippingFee != null ? formatMoney(placedOrder.shippingFee) : FEE_MISSING_MESSAGE}</p>}
                {placedOrder?.adjusted && placedOrder.shippingFee != null && (
                  <p className="text-amber-700 font-semibold">
                    Phí vận chuyển đã được cập nhật theo báo giá mới nhất: {formatMoney(placedOrder.shippingFee)}
                  </p>
                )}
                <p className="text-sm font-bold text-brand-primary border-t border-gray-200 pt-2 mt-2">
                  Tổng hóa đơn thanh toán: {placedOrder?.total != null ? formatMoney(placedOrder.total) : TOTAL_MISSING_MESSAGE}
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
                <strong className="text-gray-900 text-right">
                  {selectedFee !== null ? formatMoney(selectedFee) : shippingFeePlaceholder}
                  {selectedFee !== null && selectedOption?.is_fallback && <span className="block text-amber-600 text-[10px]">Phí tạm tính</span>}
                </strong>
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
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-sm transition"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting || !!orderUncertain || selectedFee === null || phoneBlocked}
                  className={`flex-1 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-sm flex items-center justify-center gap-1.5 ${isSubmitting || !!orderUncertain || selectedFee === null || phoneBlocked ? 'bg-brand-primary/50 cursor-not-allowed' : 'btn-primary'}`}
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
        phoneNumber={phoneNormalized}
        needsResend={otpNeedsResend}
        onResent={() => setOtpNeedsResend(false)}
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
