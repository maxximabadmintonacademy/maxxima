// Resit bayaran: guna templat yang sama dengan invois (lihat invoice.js).
import { receiptHtml as rh, openReceiptDoc } from './invoice.js';
export const receiptHtml = rh;
export const openReceipt = id => openReceiptDoc(id);
