import { Blog, Branch, Category, Product, StringOption } from '../../types';
import rawData from '../../data.json';
import { delay, OMS_API_URL, PMI_PROXY_URL, SIMULATED_LATENCY, WMS_PROXY_URL } from './constants';
import { findManualChannel, findStorefrontChannel, getChannels } from './omsHelpers';
import { mapPmiProduct } from './productMappers';
import { ApiListResponse, CreateOrderPayload, OmsChannel, OmsCustomer, OmsCustomerInput, PmiProduct, SendOtpResponse, VerifyOtpResponse } from './types';

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
    try {
      const url = `${WMS_PROXY_URL}/public/stock?sku_codes=${encodeURIComponent(chunk.join(','))}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`WMS public stock endpoint returned status ${response.status}`);
        return;
      }

      const data = await response.json();

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
    } catch (error) {
      console.warn('Failed to fetch stock from WMS chunk:', error);
    }
  };

  await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));

  return result;
}

async function mergeWmsStock(products: Product[]): Promise<Product[]> {
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

  if (allSkus.length === 0) {
    return products;
  }

  const stockMap = await fetchWmsStock(allSkus);

  return products.map((product) => {
    let aggregateStock = 0;

    const updatedVariants = product.variants?.map((variant) => {
      let variantStock = variant.stock || 0;
      if (variant.sku_code && Object.prototype.hasOwnProperty.call(stockMap, variant.sku_code)) {
        variantStock = stockMap[variant.sku_code] ?? 0;
      }
      aggregateStock += variantStock;
      return {
        ...variant,
        stock: variantStock
      };
    });

    let finalProductStock = product.stock;
    if (updatedVariants && updatedVariants.length > 0) {
      finalProductStock = aggregateStock;
    } else if (product.defaultSku && Object.prototype.hasOwnProperty.call(stockMap, product.defaultSku)) {
      finalProductStock = stockMap[product.defaultSku] ?? 0;
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

async function getProducts(): Promise<Product[]> {
  await delay(SIMULATED_LATENCY);
  const [pmiProducts, categories] = await Promise.all([fetchAllPmiProducts(), getCategories()]);
  const products = pmiProducts.flatMap((product) => mapPmiProduct(product, categories) ?? []);
  return mergeWmsStock(products);
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

async function getBlogs(): Promise<Blog[]> {
  await delay(SIMULATED_LATENCY);
  return JSON.parse(JSON.stringify(rawData.blogs)) as Blog[];
}

async function getBlogById(id: string): Promise<Blog | null> {
  const blog = rawData.blogs.find((item) => item.id === id);
  return blog ? (JSON.parse(JSON.stringify(blog)) as Blog) : null;
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

async function getStringOptions(): Promise<StringOption[]> {
  await delay(SIMULATED_LATENCY);
  try {
    const products = await getProducts();
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
  } catch (error) {
    console.warn('Failed to fetch dynamic string options from API:', error);
    return [];
  }
}

async function getConstants() {
  return JSON.parse(JSON.stringify(rawData.constants));
}

async function createOrder(orderData: CreateOrderPayload) {
  const response = await fetch(`${OMS_API_URL}/orders`, {
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

async function createSepayCheckout(orderId: number | string, orderNumber?: string) {
  const payload = typeof orderId === 'number' ? { order_id: orderId } : { order_number: orderId || orderNumber };
  const response = await fetch(`${OMS_API_URL}/api/payments/checkout`, {
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
  const response = await fetch(`${OMS_API_URL}/api/sms/send-otp`, {
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
  const response = await fetch(`${OMS_API_URL}/api/sms/verify-otp`, {
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

async function findOrCreateCustomer(customer: OmsCustomerInput): Promise<number> {
  const createResponse = await fetch(`${OMS_API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer)
  });

  if (createResponse.ok || createResponse.status === 409) {
    const created = (await createResponse.json()) as OmsCustomer;
    if (created && typeof created.id === 'number') {
      return created.id;
    }
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to create customer: ${errorText}`);
}

async function getOrCreateManualChannelId(): Promise<number> {
  const searchedChannels = await getChannels('MANUAL');
  const searchedManual = findManualChannel(searchedChannels);
  if (searchedManual) {
    return searchedManual.id;
  }

  const channels = await getChannels();
  const manual = findManualChannel(channels);
  if (manual) {
    return manual.id;
  }

  const activeChannel = channels.find((channel) => channel.is_active);
  if (activeChannel) {
    return activeChannel.id;
  }

  const createResponse = await fetch(`${OMS_API_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'MANUAL',
      name: 'Manual',
      is_active: true
    })
  });

  if (createResponse.ok) {
    const created = (await createResponse.json()) as OmsChannel;
    return created.id;
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to resolve channel: ${errorText}`);
}

async function getOrCreateStorefrontChannelId(): Promise<number> {
  const searchedChannels = await getChannels('STOREFRONT');
  const searchedStorefront = findStorefrontChannel(searchedChannels);
  if (searchedStorefront) {
    return searchedStorefront.id;
  }

  const channels = await getChannels();
  const storefront = findStorefrontChannel(channels);
  if (storefront) {
    return storefront.id;
  }

  const activeChannel = channels.find((channel) => channel.is_active);
  if (activeChannel) {
    return activeChannel.id;
  }

  const createResponse = await fetch(`${OMS_API_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'STOREFRONT',
      name: 'Storefront',
      is_active: true
    })
  });

  if (createResponse.ok) {
    const created = (await createResponse.json()) as OmsChannel;
    return created.id;
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to resolve channel: ${errorText}`);
}

export const sportApi = {
  getProducts,
  getProductById,
  getWmsStock: fetchWmsStock,
  getBlogs,
  getCategories,
  getBlogById,
  getBranches,
  getStringOptions,
  getConstants,
  createOrder,
  createSepayCheckout,
  sendOtp,
  verifyOtp,
  findOrCreateCustomer,
  getOrCreateManualChannelId,
  getOrCreateStorefrontChannelId,
};
