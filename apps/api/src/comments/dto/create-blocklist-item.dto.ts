import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { BlocklistType } from '@jazz-portfolio/shared';

export class CreateBlocklistItemDto {
  @IsEnum(BlocklistType)
  type!: BlocklistType;

  @IsString()
  @Length(1, 250)
  value!: string;


  @IsOptional()
  @IsString()
  pattern?: string;
}
