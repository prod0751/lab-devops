import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
}

export class MoveStockDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  type!: MovementType;

  @ApiProperty()
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
