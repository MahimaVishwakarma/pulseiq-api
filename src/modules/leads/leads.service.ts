import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, LeadQueryDto, CreateNoteDto, CreateDealDto } from './dto/lead.dto';
import { paginate, getPrismaSkip } from '../../common/utils/pagination.util';
import { Prisma, LeadStage, SignalType } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateLeadDto) {
    let companyId: string | undefined;

    if (dto.companyName) {
      // Find or create company by domain
      const existingCompany = dto.companyDomain
        ? await this.prisma.company.findFirst({ where: { domain: dto.companyDomain } })
        : null;

      const company = existingCompany
        ? existingCompany
        : await this.prisma.company.create({
            data: { name: dto.companyName, domain: dto.companyDomain },
          });
      companyId = company.id;
    }

    return this.prisma.lead.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        linkedinUrl: dto.linkedinUrl,
        title: dto.title,
        department: dto.department,
        tags: dto.tags ?? [],
        workspaceId,
        ...(companyId && { companyId }),
      },
      include: { company: true, signals: true },
    });
  }

  async findAll(workspaceId: string, query: LeadQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortField = query.sortBy ?? 'intentScore';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.LeadWhereInput = {
      workspaceId,
      ...(query.stage && { stage: query.stage as LeadStage }),
      ...(query.signalType && { signalType: query.signalType as SignalType }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { company: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
      ...(query.industry && { company: { industry: query.industry } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip: getPrismaSkip(page, limit),
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          company: true,
          signals: { orderBy: { strength: 'desc' }, take: 5 },
          _count: { select: { notes: true, deals: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(workspaceId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        company: true,
        signals: { orderBy: { detectedAt: 'desc' } },
        notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        tasks: { include: { assignee: true }, orderBy: { dueDate: 'asc' } },
        deals: { orderBy: { createdAt: 'desc' } },
        campaignLeads: { include: { campaign: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(workspaceId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(workspaceId, id);

    // Auto-update signal type based on score
    const signalType = dto.intentScore != null
      ? dto.intentScore >= 85 ? SignalType.HOT : dto.intentScore >= 60 ? SignalType.WARM : SignalType.COLD
      : undefined;

    return this.prisma.lead.update({
      where: { id },
      data: { ...dto, ...(signalType && { signalType }), stage: dto.stage as LeadStage | undefined },
      include: { company: true },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.lead.delete({ where: { id } });
  }

  async addNote(workspaceId: string, leadId: string, userId: string, dto: CreateNoteDto) {
    await this.findOne(workspaceId, leadId);
    return this.prisma.leadNote.create({
      data: { content: dto.content, leadId, authorId: userId },
      include: { author: true },
    });
  }

  async addDeal(workspaceId: string, leadId: string, dto: CreateDealDto) {
    await this.findOne(workspaceId, leadId);
    return this.prisma.deal.create({
      data: {
        title: dto.title,
        value: dto.value,
        currency: dto.currency,
        stage: dto.stage as import('@prisma/client').DealStage | undefined,
        probability: dto.probability,
        leadId,
      },
    });
  }

  async getIntentSignals(workspaceId: string, leadId: string) {
    await this.findOne(workspaceId, leadId);
    return this.prisma.intentSignal.findMany({
      where: { leadId },
      orderBy: [{ strength: 'desc' }, { detectedAt: 'desc' }],
    });
  }

  async bulkImport(workspaceId: string, leads: CreateLeadDto[]) {
    const results = await Promise.allSettled(
      leads.map((dto) => this.create(workspaceId, dto)),
    );

    return {
      imported: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }
}
