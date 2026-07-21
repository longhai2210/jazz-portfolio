import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123', description: 'Current admin password' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'newSecurePassword456', description: 'New secure admin password' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword!: string;
}
