import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { IsString, IsOptional, IsIn } from 'class-validator';

class CopilotDto {
  @IsString() query: string;
}

class RewriteEmailDto {
  @IsString() subject: string;
  @IsString() body: string;
  @IsOptional() @IsIn(['professional', 'casual', 'persuasive']) tone?: 'professional' | 'casual' | 'persuasive';
}

class SpamScoreDto {
  @IsString() subject: string;
  @IsString() body: string;
}

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/ai')
export class AiController {
  constructor(private service: AiService) {}

  @Post('copilot')
  @ApiOperation({ summary: 'Ask the AI Copilot a question' })
  copilot(@WorkspaceId() wsId: string, @Body() dto: CopilotDto) {
    return this.service.copilot(wsId, dto.query);
  }

  @Post('email/rewrite')
  @ApiOperation({ summary: 'AI-rewrite a cold email' })
  rewrite(@Body() dto: RewriteEmailDto) {
    return this.service.rewriteEmail(dto.subject, dto.body, dto.tone);
  }

  @Post('email/ab-variants')
  @ApiOperation({ summary: 'Generate A/B test variants' })
  abVariants(@Body() dto: RewriteEmailDto) {
    return this.service.generateAbVariants(dto.subject, dto.body);
  }

  @Post('email/spam-score')
  @ApiOperation({ summary: 'Score email for spam triggers' })
  spamScore(@Body() dto: SpamScoreDto) {
    return this.service.scoreSpam(dto.subject, dto.body);
  }

  @Get('leads/:leadId/insight')
  @ApiOperation({ summary: 'Generate AI insight for a lead' })
  leadInsight(@WorkspaceId() wsId: string, @Param('leadId') leadId: string) {
    return this.service.generateLeadInsight(wsId, leadId);
  }

  @Post('insights/generate')
  @ApiOperation({ summary: 'Generate deliverability AI insights' })
  generateInsights(@WorkspaceId() wsId: string) {
    return this.service.generateDeliverabilityInsights(wsId);
  }

  @Get('insights')
  @ApiOperation({ summary: 'List active AI insights' })
  getInsights(@WorkspaceId() wsId: string) {
    return this.service.getInsights(wsId);
  }

  @Patch('insights/:insightId/dismiss')
  @ApiOperation({ summary: 'Dismiss an AI insight' })
  dismiss(@WorkspaceId() wsId: string, @Param('insightId') insightId: string) {
    return this.service.dismissInsight(wsId, insightId);
  }
}
