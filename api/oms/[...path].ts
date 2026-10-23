import { proxyOmsCheckout } from '../_catalogProxy.js';

export default async function handler(req: any, res: any) {
  return proxyOmsCheckout(req, res);
}
