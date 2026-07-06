import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInboxDto, UpdateInboxDto, InboxQueryDto } from './dto/inbox.dto';
import { ConfigService } from '@nestjs/config';
import { encrypt } from '../../common/utils/crypto.util';
import { paginate, getPrismaSkip } from '../../common/utils/pagination.util';
import { InboxStatus, Prisma } from '@prisma/client';

@Injectable()
export class InboxesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(workspaceId: string, dto: CreateInboxDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const inboxCount = await this.prisma.inbox.count({ where: { workspaceId } });
    if (inboxCount >= workspace.maxInboxes) {
      throw new BadRequestException(`Plan limit reached: max ${workspace.maxInboxes} inboxes`);
    }

    const existing = await this.prisma.inbox.findUnique({
      where: { workspaceId_email: { workspaceId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Inbox already exists');

    const encKey = this.config.get<string>('encryption.key') ?? '';
    const data: Prisma.InboxCreateInput = {
      email: dto.email,
      displayName: dto.displayName,
      provider: dto.provider ?? 'gmail',
      workspace: { connect: { id: workspaceId } },
      ...(dto.domainId && { domain: { connect: { id: dto.domainId } } }),
      ...(dto.smtpHost && { smtpHost: dto.smtpHost }),
      ...(dto.smtpPort && { smtpPort: dto.smtpPort }),
      ...(dto.smtpUser && { smtpUser: dto.smtpUser }),
      ...(dto.smtpPass && { smtpPassEnc: encrypt(dto.smtpPass, encKey) }),
      ...(dto.oauthToken && { oauthTokenEnc: encrypt(dto.oauthToken, encKey) }),
    };

    return this.prisma.inbox.create({ data });
  }

  async findAll(workspaceId: string, query: InboxQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.InboxWhereInput = {
      workspaceId,
      ...(query.status && { status: query.status as InboxStatus }),
    };

    const [data, total] = await Promise.all([
      this.prisma.inbox.findMany({
        where,
        skip: getPrismaSkip(page, limit),
        take: limit,
        orderBy: { healthScore: 'desc' },
        include: {
          domain: { select: { domain: true, status: true } },
          _count: { select: { warmupLogs: true, sentEmails: true } },
        },
      }),
      this.prisma.inbox.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(workspaceId: string, id: string) {
    const inbox = await this.prisma.inbox.findFirst({
      where: { id, workspaceId },
      include: {
        domain: true,
        warmupLogs: { orderBy: { date: 'desc' }, take: 30 },
        _count: { select: { sentEmails: true } },
      },
    });
    if (!inbox) throw new NotFoundException('Inbox not found');
    return inbox;
  }

  async update(workspaceId: string, id: string, dto: UpdateInboxDto) {
    await this.findOne(workspaceId, id);
    return this.prisma.inbox.update({ where: { id }, data: dto });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.inbox.delete({ where: { id } });
  }

  async pause(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.inbox.update({
      where: { id },
      data: { status: InboxStatus.PAUSED, warmupEnabled: false },
    });
  }

  async resume(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.inbox.update({
      where: { id },
      data: { status: InboxStatus.WARMING, warmupEnabled: true },
    });
  }

  async getHealthSummary(workspaceId: string) {
    const grouped = await this.prisma.inbox.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { _all: true },
    });

    const avgHealth = await this.prisma.inbox.aggregate({
      where: { workspaceId },
      _avg: { healthScore: true },
    });

    return {
      byStatus: grouped.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = g._count._all;
        return acc;
      }, {}),
      avgHealthScore: Math.round(avgHealth._avg.healthScore ?? 0),
    };
  }
}
