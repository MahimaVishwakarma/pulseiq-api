import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../../common/decorators/workspace.decorator';
import type { User } from '@prisma/client';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private service: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  create(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for current user' })
  list(@CurrentUser() user: User) {
    return this.service.findAllForUser(user.id);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get workspace details' })
  findOne(@Param('workspaceId') id: string) {
    return this.service.findOne(id);
  }

  @Get(':workspaceId/stats')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get workspace stats (dashboard)' })
  stats(@Param('workspaceId') id: string) {
    return this.service.getStats(id);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Update workspace' })
  update(@Param('workspaceId') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Remove member from workspace' })
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.removeMember(workspaceId, memberId, user.id);
  }
}
