import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = dto.slug ?? this.slugify(dto.name);

    const existing = await this.prisma.workspace.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" is already taken`);

    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug,
        industry: dto.industry,
        website: dto.website,
        members: {
          create: { userId, role: UserRole.ADMIN },
        },
      },
      include: { members: { include: { user: true } } },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: true } },
        _count: { select: { inboxes: true, leads: true, campaigns: true } },
      },
    });
  }

  async findOne(id: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        _count: { select: { inboxes: true, leads: true, campaigns: true } },
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    await this.findOne(id);
    return this.prisma.workspace.update({ where: { id }, data: dto });
  }

  async getStats(workspaceId: string) {
    const [inboxCount, leadCount, campaignCount, recentActivity] = await Promise.all([
      this.prisma.inbox.count({ where: { workspaceId } }),
      this.prisma.lead.count({ where: { workspaceId } }),
      this.prisma.campaign.count({ where: { workspaceId } }),
      this.prisma.activity.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { lead: { select: { firstName: true, lastName: true, company: { select: { name: true } } } } },
      }),
    ]);

    const warmedInboxes = await this.prisma.inbox.count({
      where: { workspaceId, status: 'WARMED' },
    });

    const activeInboxes = await this.prisma.inbox.count({
      where: { workspaceId, status: { in: ['WARMING', 'WARMED'] } },
    });

    const hotLeads = await this.prisma.lead.count({
      where: { workspaceId, intentScore: { gte: 85 } },
    });

    return {
      inboxes: { total: inboxCount, warmed: warmedInboxes, active: activeInboxes },
      leads: { total: leadCount, hot: hotLeads },
      campaigns: { total: campaignCount },
      recentActivity,
    };
  }

  async removeMember(workspaceId: string, memberId: string, requestingUserId: string) {
    const requestingMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requestingUserId },
    });
    if (!requestingMember || requestingMember.role === 'VIEWER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
