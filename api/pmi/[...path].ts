import { proxyToVoma } from '../_catalogProxy.js';

export default async function handler(req: any, res: any) {
  return proxyToVoma(req, res, process.env.PMI_API_URL);
}
