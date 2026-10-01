import { Product, Blog } from './types';
import rawData from './data.json';

export const products = rawData.products as Product[];
export const blogs = rawData.blogs as Blog[];
export const constants = rawData.constants;
