import { IsString, IsOptional, IsEmail, IsInt, IsIn, IsArray, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLeadDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() companyDomain?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateLeadDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) intentScore?: number;
  @IsOptional() @IsIn(['NEW','RESEARCHING','CONTACTED','ENGAGED','QUALIFIED','PROPOSAL','CLOSED_WON','CLOSED_LOST']) stage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class LeadQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() signalType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
}

export class CreateNoteDto {
  @IsString() content: string;
}

export class CreateDealDto {
  @IsString() title: string;
  @IsOptional() @IsInt() value?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsInt() probability?: number;
}
