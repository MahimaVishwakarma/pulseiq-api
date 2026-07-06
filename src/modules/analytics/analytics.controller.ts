import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard KPIs' })
  dashboard(@WorkspaceId() wsId: string) {
    return this.service.getDashboardStats(wsId);
  }

  @Get('warmup-chart')
  @ApiOperation({ summary: 'Warmup chart time-series data' })
  warmupChart(@WorkspaceId() wsId: string, @Query('days') days?: string) {
    return this.service.getWarmupChartData(wsId, days ? parseInt(days, 10) : 30);
  }

  @Get('activity-feed')
  @ApiOperation({ summary: 'Recent activity feed' })
  activity(@WorkspaceId() wsId: string, @Query('limit') limit?: string) {
    return this.service.getActivityFeed(wsId, limit ? parseInt(limit, 10) : 20);
  }
}
