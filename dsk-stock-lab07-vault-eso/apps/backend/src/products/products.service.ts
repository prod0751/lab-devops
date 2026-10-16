import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { MoveStockDto, MovementType } from './dto/move-stock.dto';
import { UpdateProductDto } from './dto/update-product.dto';

interface FindAllParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const SORTABLE_FIELDS = ['name', 'sku', 'category', 'quantity', 'updatedAt', 'unitPrice'];

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto, userId?: string) {
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        unitPrice: new Prisma.Decimal(dto.unitPrice),
      },
    });
    await this.prisma.stockMovement.create({
      data: {
        productId: product.id,
        userId,
        type: MovementType.IN,
        qty: dto.quantity,
        note: 'Initial stock',
      },
    });
    return product;
  }

  async findAll(params: FindAllParams) {
    const { page, pageSize, search, sortBy, sortOrder } = params;
    const where: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sortBy && SORTABLE_FIELDS.includes(sortBy)
        ? { [sortBy]: sortOrder === 'asc' ? Prisma.SortOrder.asc : Prisma.SortOrder.desc }
        : { updatedAt: Prisma.SortOrder.desc };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy,
      }),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto, userId?: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        unitPrice: dto.unitPrice !== undefined ? new Prisma.Decimal(dto.unitPrice) : undefined,
      },
    });
    await this.prisma.stockMovement.create({
      data: {
        productId: id,
        userId,
        type: MovementType.IN,
        qty: 0,
        note: 'Product updated',
      },
    });
    return product;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.stockMovement.deleteMany({ where: { productId: id } });
    return this.prisma.product.delete({ where: { id } });
  }

  async move(id: string, dto: MoveStockDto, userId?: string) {
    const product = await this.ensureExists(id);
    let newQty = product.quantity;
    if (dto.type === MovementType.IN) {
      newQty += dto.qty;
    } else {
      newQty -= dto.qty;
      if (newQty < 0) {
        throw new BadRequestException('Quantity cannot be negative');
      }
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: { quantity: newQty },
    });
    await this.prisma.stockMovement.create({
      data: {
        productId: id,
        userId,
        type: dto.type,
        qty: dto.qty,
        note: dto.note,
      },
    });
    return updated;
  }

  async movementHistory(productId: string) {
    await this.ensureExists(productId);
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensureExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}
