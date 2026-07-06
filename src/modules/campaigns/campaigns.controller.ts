import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, CampaignQueryDto, EnrollLeadsDto } from './dto/campaign.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/campaigns')
export class CampaignsController {
  constructor(private service: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create campaign' })
  create(@WorkspaceId() wsId: string, @Body() dto: CreateCampaignDto) {
    return this.service.create(wsId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  findAll(@WorkspaceId() wsId: string, @Query() query: CampaignQueryDto) {
    return this.service.findAll(wsId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign detail' })
  findOne(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.findOne(wsId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign' })
  update(@WorkspaceId() wsId: string, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.service.update(wsId, id, dto);
  }

  @Post(':id/launch')
  @ApiOperation({ summary: 'Launch campaign' })
  launch(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.launch(wsId, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause campaign' })
  pause(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.pause(wsId, id);
  }

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll leads into campaign' })
  enroll(@WorkspaceId() wsId: string, @Param('id') id: string, @Body() dto: EnrollLeadsDto) {
    return this.service.enrollLeads(wsId, id, dto);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Campaign analytics' })
  analytics(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.getAnalytics(wsId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campaign' })
  remove(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.findOne(wsId, id).then(() =>
      this.service['prisma'].campaign.delete({ where: { id } }),
    );
  }
}
