import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';

@ApiTags('Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/domains')
export class DomainsController {
  constructor(private service: DomainsService) {}

  @Post()
  @ApiOperation({ summary: 'Add domain' })
  create(@WorkspaceId() wsId: string, @Body('domain') domain: string) {
    return this.service.create(wsId, domain);
  }

  @Get()
  @ApiOperation({ summary: 'List domains' })
  findAll(@WorkspaceId() wsId: string) {
    return this.service.findAll(wsId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get domain' })
  findOne(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.findOne(wsId, id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Run DNS verification' })
  verify(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.verify(wsId, id);
  }
}
