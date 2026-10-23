import { Branch, Category, Product, StringOption } from '../../types';
import rawData from '../../data.json';
import { delay, OMS_CHECKOUT_PROXY_URL, PMI_PROXY_URL, SIMULATED_LATENCY, WMS_PROXY_URL } from './constants';
import { mapPmiProduct } from './productMappers';
import { ApiListResponse, CreateOrderPayload, PmiProduct, SendOtpResponse, VerifyOtpResponse } from './types';

// Đọc phản hồi /public/stock ({stock:{sku:qty}} hoặc {items:[{sku_code,...}]}).
function parseWmsStock(data: any): Record<string, number> {
  const result: Record<string, number> = {};
  if (data && typeof data.stock === 'object' && data.stock !== null) {
    for (const [sku, qty] of Object.entries(data.stock)) {
      result[sku] = Number(qty) || 0;
    }
  } else if (data && Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && item.sku_code) {
        result[item.sku_code] = Number(item.qty_available ?? item.qty_on_hand ?? 0);
      }
    }
  }
  return result;
}

// STOR-012: MỘT request /public/stock không sku_codes = toàn bộ tồn của seller
// theo grant (WMS sku_stock(db, None): chỉ SKU có dòng tồn). STOR-015: lỗi ->
// console.error nêu URL rồi NÉM (tồn chỉ lấy từ WMS, không dùng tồn PIM thay).
async function fetchAllWmsStock(): Promise<Record<string, number>> {
  const url = `${WMS_PROXY_URL}/public/stock`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error(`Failed to fetch stock from ${url}:`, error);
    throw error;
  }
  if (!response.ok) {
    console.error(`Failed to fetch stock: ${url} returned status ${response.status}`);
    throw new Error(`WMS stock failed with status ${response.status}`);
  }
  return parseWmsStock(await response.json());
}

async function fetchWmsStock(skuCodes: string[]): Promise<Record<string, number>> {
  const uniqueSkus = Array.from(new Set(skuCodes.filter((sku) => Boolean(sku && sku.trim()))));
  if (uniqueSkus.length === 0) {
    return {};
  }

  const CHUNK_SIZE = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueSkus.length; i += CHUNK_SIZE) {
    chunks.push(uniqueSkus.slice(i, i + CHUNK_SIZE));
  }

  const result: Record<string, number> = {};

  const fetchChunk = async (chunk: string[]) => {
    const url = `${WMS_PROXY_URL}/public/stock?sku_codes=${encodeURIComponent(chunk.join(','))}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      console.error(`Failed to fetch stock from ${url}:`, error);
      throw error;
    }
    if (!response.ok) {
      console.error(`Failed to fetch stock: ${url} returned status ${response.status}`);
      throw new Error(`WMS stock failed with status ${response.status}`);
    }
    Object.assign(result, parseWmsStock(await response.json()));
  };

  await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));

  return result;
}

function collectSkus(products: Product[]): string[] {
  const allSkus: string[] = [];
  for (const product of products) {
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.sku_code) {
          allSkus.push(variant.sku_code);
        }
      }
    } else if (product.defaultSku) {
      allSkus.push(product.defaultSku);
    }
  }
  return allSkus;
}

async function mergeWmsStock(products: Product[]): Promise<Product[]> {
  const allSkus = collectSkus(products);
  if (allSkus.length === 0) {
    return products;
  }
  try {
    return applyWmsStock(products, await fetchWmsStock(allSkus));
  } catch {
    // Đã console.error ở fetchWmsStock; tồn không rõ, không giữ tồn PIM.
    return applyWmsStock(products, null);
  }
}

// stockMap = TOÀN BỘ tồn WMS nên SKU vắng = WMS không có dòng tồn = 0.
// stockMap null = tồn không tải được -> stock undefined (không biết), không giữ
// variant.stock của PIM (PIM không có trường tồn).
function applyWmsStock(products: Product[], stockMap: Record<string, number> | null): Product[] {
  const read = (sku: string) => (stockMap ? stockMap[sku] ?? 0 : undefined);

  return products.map((product) => {
    let aggregateStock: number | undefined = stockMap ? 0 : undefined;

    const updatedVariants = product.variants?.map((variant) => {
      const variantStock = variant.sku_code ? read(variant.sku_code) : stockMap ? 0 : undefined;
      if (variantStock !== undefined && aggregateStock !== undefined) aggregateStock += variantStock;
      return {
        ...variant,
        stock: variantStock
      };
    });

    let finalProductStock: number | undefined = stockMap ? product.stock : undefined;
    if (updatedVariants && updatedVariants.length > 0) {
      finalProductStock = aggregateStock;
    } else if (product.defaultSku) {
      finalProductStock = read(product.defaultSku);
    }

    return {
      ...product,
      stock: finalProductStock,
      variants: updatedVariants || product.variants
    };
  });
}

async function getCategories(): Promise<Category[]> {
  const url = `${PMI_PROXY_URL}/public/voma-categories`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error(`Failed to fetch categories from ${url}:`, error);
    throw error;
  }
  if (!response.ok) {
    console.error(`Failed to fetch categories: ${url} returned status ${response.status}`);
    throw new Error(`PMI getCategories failed with status ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    console.error(`Failed to fetch categories: ${url} returned a non-array body`);
    throw new Error('PMI getCategories returned an unexpected body');
  }
  return data;
}

const PRODUCTS_PAGE_SIZE = 100;

// Lấy HẾT mọi trang /public/products (hợp đồng PIM: page>=1, limit<=100, trả
// {items,total,page,limit,pages}). Lỗi/thiếu món -> ném, không trả danh sách cụt.
async function fetchAllPmiProducts(): Promise<PmiProduct[]> {
  const all: PmiProduct[] = [];
  let pages = 1;
  let total = 0;
  for (let page = 1; page <= pages; page += 1) {
    const url = `${PMI_PROXY_URL}/public/products?page=${page}&limit=${PRODUCTS_PAGE_SIZE}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      console.error(`Failed to fetch products from ${url}:`, error);
      throw error;
    }
    if (!response.ok) {
      console.error(`Failed to fetch products: ${url} returned status ${response.status}`);
      throw new Error(`PMI getProducts failed with status ${response.status}`);
    }
    const data = (await response.json()) as ApiListResponse<PmiProduct>;
    if (!data || !Array.isArray(data.items) || typeof data.total !== 'number' || typeof data.pages !== 'number') {
      console.error(`Failed to fetch products: ${url} returned a body without items/total/pages`);
      throw new Error('PMI getProducts returned an unexpected body');
    }
    all.push(...data.items);
    pages = data.pages;
    total = data.total;
  }
  if (all.length !== total) {
    console.error(`Failed to fetch products: collected ${all.length} items but PIM reports total=${total}`);
    throw new Error(`PMI getProducts collected ${all.length} of ${total} products`);
  }
  return all;
}

// STOR-012: danh mục, products và toàn bộ tồn bắn SONG SONG đúng 1 lần.
// `categories` (đã tải bởi fetchAppData) dùng lại, không gọi lại getCategories;
// danh mục lỗi vẫn làm lỗi cả sản phẩm (spec a4f6975e).
// STOR-015: `stock` (promise tồn của fetchAppData) lỗi KHÔNG làm lỗi sản phẩm:
// sản phẩm trả về với stock=undefined.
// Cùng độ trễ mô phỏng với getProducts để tồn và sản phẩm bắn song song (STOR-012).
async function getAllStock(): Promise<Record<string, number>> {
  await delay(SIMULATED_LATENCY);
  return fetchAllWmsStock();
}

async function getProducts(categories?: Promise<Category[]>, stock?: Promise<Record<string, number>>): Promise<Product[]> {
  await delay(SIMULATED_LATENCY);
  const stockP = (stock ?? fetchAllWmsStock()).catch(() => null);
  const [pmiProducts, loadedCategories, stockMap] = await Promise.all([
    fetchAllPmiProducts(),
    categories ?? getCategories(),
    stockP
  ]);
  const products = pmiProducts.flatMap((product) => mapPmiProduct(product, loadedCategories) ?? []);
  return stockMap && collectSkus(products).length === 0 ? products : applyWmsStock(products, stockMap);
}

async function getProductById(id: string): Promise<Product | null> {
  await delay(SIMULATED_LATENCY);
  try {
    const [response, categories] = await Promise.all([
      fetch(`${PMI_PROXY_URL}/public/products/${id}`),
      getCategories()
    ]);

    if (response.ok) {
      const pmiProduct = (await response.json()) as PmiProduct;
      const product = mapPmiProduct(pmiProduct, categories);
      if (!product) {
        return null;
      }
      const [updatedProduct] = await mergeWmsStock([product]);
      return updatedProduct || product;
    }

    if (response.status !== 404) {
      throw new Error(`PMI getProductById failed with status ${response.status}`);
    }
  } catch (error) {
    console.error(error);
  }

  // Lỗi tải danh sách ở đây được ném lên caller (không còn trả null giả).
  const products = await getProducts();
  return products.find((product) => product.id === id) || null;
}

async function getBranches(): Promise<Branch[]> {
  return JSON.parse(JSON.stringify(rawData.branches)) as Branch[];
}

function resolveStringType(stiffness: string | undefined): StringOption['type'] {
  const stiffnessLower = stiffness?.toLowerCase() || '';
  if (stiffnessLower.includes('bền')) return 'Độ bền';
  if (stiffnessLower.includes('kiểm soát')) return 'Kiểm soát';
  return 'Trợ lực / Âm thanh';
}

async function getStringOptions(loadedProducts?: Promise<Product[]>): Promise<StringOption[]> {
  await delay(SIMULATED_LATENCY);
  // Lỗi getProducts ném thẳng lên (không trả [] -- khách không được tưởng shop không có cước).
  // STOR-012: nhận products đã tải từ fetchAppData, không gọi lại getProducts.
  const products = await (loadedProducts ?? getProducts());
  // Cước chưa có ngành VOMA riêng (nằm lẫn trong nhóm "Khác"), nên nhận diện
  // sản phẩm cước qua thuộc tính `thickness` thật của PIM thay vì theo ngành.
  const stringProducts = products.filter((product) =>
    product.attributes?.some((attribute) => attribute.code === 'thickness')
  );

  // Cước không có giá thật không thể thêm giỏ -> bỏ khỏi bộ chọn, nói rõ id.
  return stringProducts.flatMap((product): StringOption[] => {
    if (product.price === undefined) {
      console.warn(`Bỏ cước ${product.id} khỏi bộ chọn cước: chưa có giá thật`);
      return [];
    }
    return [{
      id: product.id,
      name: product.name,
      brand: product.brand,
      type: resolveStringType(product.specs.stiffness),
      thickness: product.attributes?.find((attribute) => attribute.code === 'thickness')?.value,
      price: product.price,
      colors: product.colors || []
    }];
  });
}

async function getConstants() {
  return JSON.parse(JSON.stringify(rawData.constants));
}

async function createOrder(orderData: CreateOrderPayload) {
  const response = await fetch(`${OMS_CHECKOUT_PROXY_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Failed to create order: ${errorText}`) as any;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function createSepayCheckout(orderNumber: string) {
  const payload = { order_number: orderNumber };
  const response = await fetch(`${OMS_CHECKOUT_PROXY_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Failed to create SePay checkout form: ${errorText}`) as any;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<{ action: string; fields: Record<string, string> }>;
}

async function sendOtp(phoneNumber: string): Promise<SendOtpResponse> {
  const response = await fetch(`${OMS_CHECKOUT_PROXY_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw {
      status: response.status,
      message: errorData.detail || 'Failed to send OTP'
    };
  }

  return response.json();
}

async function verifyOtp(phoneNumber: string, otpCode: string): Promise<VerifyOtpResponse> {
  const response = await fetch(`${OMS_CHECKOUT_PROXY_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw {
      status: response.status,
      message: errorData.detail || 'Failed to verify OTP'
    };
  }

  return response.json();
}

export const sportApi = {
  getProducts,
  getProductById,
  getWmsStock: fetchWmsStock,
  getAllStock,
  getCategories,
  getBranches,
  getStringOptions,
  getConstants,
  createOrder,
  createSepayCheckout,
  sendOtp,
  verifyOtp,
};
