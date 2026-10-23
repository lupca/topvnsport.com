import { Product, Branch } from './types';
import rawData from './data.json';

export const products = rawData.products as Product[];
export const branches = rawData.branches as Branch[];
export const constants = rawData.constants;
