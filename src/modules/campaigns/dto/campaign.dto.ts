import { IsString, IsOptional, IsInt, IsBoolean, IsArray, IsIn, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignStepDto {
  @IsInt() order: number;
  @IsIn(['EMAIL', 'DELAY', 'CONDITION', 'TASK']) type: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsInt() delayDays?: number;
  @IsOptional() @IsInt() delayHours?: number;
  @IsOptional() @IsString() conditionType?: string;
  @IsOptional() @IsString() taskDescription?: string;
}

export class CreateCampaignDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() fromName?: string;
  @IsOptional() @IsString() replyToEmail?: string;
  @IsOptional() @IsBoolean() trackOpens?: boolean;
  @IsOptional() @IsBoolean() trackClicks?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(1000) dailyLimit?: number;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CampaignStepDto) steps?: CampaignStepDto[];
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() trackOpens?: boolean;
  @IsOptional() @IsBoolean() trackClicks?: boolean;
  @IsOptional() @IsInt() dailyLimit?: number;
}

export class EnrollLeadsDto {
  @IsArray() @IsString({ each: true }) leadIds: string[];
}

export class CampaignQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() page?: number;
  @IsOptional() @IsInt() limit?: number;
}
