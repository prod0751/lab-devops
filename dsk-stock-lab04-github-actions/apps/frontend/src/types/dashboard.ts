import { Product } from './product';

export interface DashboardOverview {
  totalProducts: number;
  lowStockCount: number;
  totalValue: number;
  lowStockProducts: Product[];
  movementChart: Record<string, { in: number; out: number }>;
}
