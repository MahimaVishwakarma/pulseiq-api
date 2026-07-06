import { IsString, IsOptional, IsEmail, IsInt, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInboxDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: ['gmail', 'outlook', 'custom_smtp'] })
  @IsOptional()
  @IsIn(['gmail', 'outlook', 'custom_smtp'])
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oauthToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domainId?: string;
}

export class UpdateInboxDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  warmupEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  dailySendLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(60)
  warmupDayTarget?: number;
}

export class InboxQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  limit?: number;
}
