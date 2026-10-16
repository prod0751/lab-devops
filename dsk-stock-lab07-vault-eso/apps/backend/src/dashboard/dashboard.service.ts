import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [products, movements] = await Promise.all([
      this.prisma.product.findMany(),
      this.prisma.stockMovement.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => p.quantity <= p.minQuantity);
    const totalValue = products.reduce((sum, p) => {
      const price = Number(p.unitPrice);
      return sum + p.quantity * price;
    }, 0);

    const movementChart = movements.reduce<Record<string, { in: number; out: number }>>(
      (acc, mov) => {
        const key = mov.createdAt.toISOString().slice(0, 10);
        if (!acc[key]) {
          acc[key] = { in: 0, out: 0 };
        }
        if (mov.type === 'IN') acc[key].in += mov.qty;
        if (mov.type === 'OUT') acc[key].out += mov.qty;
        return acc;
      },
      {},
    );

    return {
      totalProducts,
      lowStockCount: lowStockProducts.length,
      totalValue,
      lowStockProducts: lowStockProducts.slice(0, 10),
      movementChart,
    };
  }
}
