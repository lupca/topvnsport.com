import { proxyToVoma } from '../_catalogProxy';

export default async function handler(req: any, res: any) {
  return proxyToVoma(req, res, process.env.WMS_API_URL);
}
