import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCampaignDto, UpdateCampaignDto, CampaignQueryDto, EnrollLeadsDto,
} from './dto/campaign.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { paginate, getPrismaSkip } from '../../common/utils/pagination.util';
import { CampaignStatus, Prisma } from '@prisma/client';

export const CAMPAIGN_QUEUE = 'campaign';

export interface CampaignJobData {
  campaignId: string;
  leadId: string;
  stepId: string;
  inboxId: string;
}

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(CAMPAIGN_QUEUE) private campaignQueue: Queue<CampaignJobData>,
  ) {}

  async create(workspaceId: string, dto: CreateCampaignDto) {
    const { steps, ...campaignData } = dto;

    return this.prisma.campaign.create({
      data: {
        ...campaignData,
        workspaceId,
        steps: steps
          ? {
              create: steps.map((s) => ({
                order: s.order,
                type: s.type as 'EMAIL' | 'DELAY' | 'CONDITION' | 'TASK',
                name: s.name,
                subject: s.subject,
                body: s.body,
                delayDays: s.delayDays,
                delayHours: s.delayHours,
                conditionType: s.conditionType,
                taskDescription: s.taskDescription,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(workspaceId: string, query: CampaignQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CampaignWhereInput = {
      workspaceId,
      ...(query.status && { status: query.status as CampaignStatus }),
    };

    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: getPrismaSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { leads: true } },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: {
        steps: { orderBy: { order: 'asc' }, include: { sends: { take: 5 } } },
        leads: {
          include: { lead: { include: { company: true } } },
          take: 50,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(workspaceId: string, id: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(workspaceId, id);
    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException('Pause campaign before editing');
    }
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async launch(workspaceId: string, id: string) {
    const campaign = await this.findOne(workspaceId, id);

    // Need at least one enrolled lead and one email step
    const hasEmailStep = campaign.steps.some((s) => s.type === 'EMAIL');
    if (!hasEmailStep) throw new BadRequestException('Campaign needs at least one EMAIL step');
    if (campaign.leads.length === 0) throw new BadRequestException('Enroll leads before launching');

    // Find a sending inbox for the workspace
    const inbox = await this.prisma.inbox.findFirst({
      where: { workspaceId, status: { in: ['WARMED', 'WARMING'] } },
      orderBy: { healthScore: 'desc' },
    });
    if (!inbox) throw new BadRequestException('No warmed or warming inbox available');

    // Schedule first step for all enrolled leads
    const firstStep = campaign.steps[0];
    for (const enrollment of campaign.leads) {
      await this.campaignQueue.add(
        'send-step',
        { campaignId: id, leadId: enrollment.leadId, stepId: firstStep.id, inboxId: inbox.id },
        { delay: 0, attempts: 3 },
      );
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ACTIVE },
    });
  }

  async pause(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    // Drain pending jobs for this campaign
    const jobs = await this.campaignQueue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.campaignId === id) await job.remove();
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED },
    });
  }

  async enrollLeads(workspaceId: string, id: string, dto: EnrollLeadsDto) {
    await this.findOne(workspaceId, id);

    const created = await Promise.allSettled(
      dto.leadIds.map((leadId) =>
        this.prisma.campaignLead.upsert({
          where: { campaignId_leadId: { campaignId: id, leadId } },
          update: {},
          create: { campaignId: id, leadId },
        }),
      ),
    );

    const count = created.filter((r) => r.status === 'fulfilled').length;
    await this.prisma.campaign.update({ where: { id }, data: { totalLeads: { increment: count } } });
    return { enrolled: count };
  }

  async getAnalytics(workspaceId: string, id: string) {
    const campaign = await this.findOne(workspaceId, id);
    return {
      totalLeads: campaign.totalLeads,
      totalSent: campaign.totalSent,
      totalOpens: campaign.totalOpens,
      totalReplies: campaign.totalReplies,
      totalBounces: campaign.totalBounces,
      inboundGenerated: campaign.inboundGenerated,
      openRate: campaign.totalSent > 0 ? campaign.totalOpens / campaign.totalSent : 0,
      replyRate: campaign.totalSent > 0 ? campaign.totalReplies / campaign.totalSent : 0,
      bounceRate: campaign.totalSent > 0 ? campaign.totalBounces / campaign.totalSent : 0,
      stepBreakdown: campaign.steps.map((s) => ({
        id: s.id,
        name: s.name ?? s.type,
        order: s.order,
        type: s.type,
        sends: s.sends.length,
      })),
    };
  }
}
