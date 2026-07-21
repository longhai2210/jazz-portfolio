import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { LoginDto as ILoginDto } from '@jazz-portfolio/shared';

export class LoginDto implements ILoginDto {
  @ApiProperty({ example: 'admin', description: 'Admin username' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'admin123', description: 'Admin password' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
