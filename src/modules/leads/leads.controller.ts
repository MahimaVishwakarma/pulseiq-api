import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto, UpdateLeadDto, LeadQueryDto, CreateNoteDto, CreateDealDto,
} from './dto/lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId, CurrentUser } from '../../common/decorators/workspace.decorator';
import type { User } from '@prisma/client';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/leads')
export class LeadsController {
  constructor(private service: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  create(@WorkspaceId() wsId: string, @Body() dto: CreateLeadDto) {
    return this.service.create(wsId, dto);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import leads' })
  bulkImport(@WorkspaceId() wsId: string, @Body() body: { leads: CreateLeadDto[] }) {
    return this.service.bulkImport(wsId, body.leads);
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters' })
  findAll(@WorkspaceId() wsId: string, @Query() query: LeadQueryDto) {
    return this.service.findAll(wsId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead 360° profile' })
  findOne(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.findOne(wsId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  update(@WorkspaceId() wsId: string, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.update(wsId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead' })
  remove(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.remove(wsId, id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add note to lead' })
  addNote(
    @WorkspaceId() wsId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.addNote(wsId, id, user.id, dto);
  }

  @Post(':id/deals')
  @ApiOperation({ summary: 'Create deal on lead' })
  addDeal(
    @WorkspaceId() wsId: string,
    @Param('id') id: string,
    @Body() dto: CreateDealDto,
  ) {
    return this.service.addDeal(wsId, id, dto);
  }

  @Get(':id/signals')
  @ApiOperation({ summary: 'Get intent signals for lead' })
  signals(@WorkspaceId() wsId: string, @Param('id') id: string) {
    return this.service.getIntentSignals(wsId, id);
  }
}
