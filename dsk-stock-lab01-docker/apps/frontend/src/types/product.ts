export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT';
  qty: number;
  note?: string | null;
  createdAt: string;
  productId: string;
  userId?: string | null;
}
