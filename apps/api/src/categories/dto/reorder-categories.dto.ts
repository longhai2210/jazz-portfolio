import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'IDs of the records in the new sorted order' })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
