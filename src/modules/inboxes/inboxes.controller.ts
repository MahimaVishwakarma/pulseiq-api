import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InboxesService } from './inboxes.service';
import { CreateInboxDto, UpdateInboxDto, InboxQueryDto } from './dto/inbox.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';

@ApiTags('Inboxes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/inboxes')
export class InboxesController {
  constructor(private service: InboxesService) {}

  @Post()
  @ApiOperation({ summary: 'Connect a new inbox' })
  create(@WorkspaceId() wsId: string, @Body() dto: CreateInboxDto) {
    return this.service.create(wsId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all inboxes' })
  findAll(@WorkspaceId() wsId: string, @Query() query: InboxQueryDto) {
    return this.service.findAll(wsId, query);
  }

  @Get('health-summary')
  @ApiOperation({ summary: 'Health summary by status' })
  healthSummary(@WorkspaceId() wsId: string) {
    return this.service.getHealthSummary(wsId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inbox details + warmup logs' })
  findOne(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.findOne(wsId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inbox settings' })
  update(@WorkspaceId() wsId: string, @Param('id') id: string, @Body() dto: UpdateInboxDto) {
    return this.service.update(wsId, id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause inbox warmup' })
  pause(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.pause(wsId, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume inbox warmup' })
  resume(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.resume(wsId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove inbox' })
  remove(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.remove(wsId, id);
  }
}
