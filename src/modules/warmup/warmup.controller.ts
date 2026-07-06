import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WarmupService } from './warmup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';

@ApiTags('Warmup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/warmup')
export class WarmupController {
  constructor(private service: WarmupService) {}

  @Get('pool-stats')
  @ApiOperation({ summary: 'Warmup pool stats' })
  poolStats(@WorkspaceId() wsId: string) {
    return this.service.getPoolStats(wsId);
  }

  @Get('inboxes/:inboxId/progress')
  @ApiOperation({ summary: 'Get warmup progress for a specific inbox' })
  progress(@Param('inboxId') inboxId: string) {
    return this.service.getWarmupProgress(inboxId);
  }
}
