import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as dns from 'dns/promises';

@Injectable()
export class DomainsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, domain: string) {
    return this.prisma.domain.upsert({
      where: { workspaceId_domain: { workspaceId, domain } },
      update: {},
      create: { domain, workspaceId },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.domain.findMany({
      where: { workspaceId },
      include: { _count: { select: { inboxes: true } } },
      orderBy: { healthScore: 'desc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id, workspaceId } });
    if (!domain) throw new NotFoundException('Domain not found');
    return domain;
  }

  async verify(workspaceId: string, id: string) {
    const domain = await this.findOne(workspaceId, id);
    const results = await this.checkDns(domain.domain);

    return this.prisma.domain.update({
      where: { id },
      data: {
        ...results,
        lastCheckedAt: new Date(),
        status: results.spfRecord && results.dkimPublicKey ? 'VERIFIED' : 'FAILED',
        healthScore: this.calculateScore(results),
      },
    });
  }

  private async checkDns(domain: string) {
    const results: {
      spfRecord?: string;
      dkimPublicKey?: string;
      dmarcPolicy?: string;
      mxRecords?: object;
    } = {};

    try {
      const txtRecords = await dns.resolveTxt(domain);
      const spf = txtRecords.flat().find((r) => r.startsWith('v=spf1'));
      if (spf) results.spfRecord = spf;
    } catch { /* DNS lookup failed */ }

    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      const dmarc = dmarcRecords.flat().find((r) => r.startsWith('v=DMARC1'));
      if (dmarc) results.dmarcPolicy = dmarc;
    } catch { /* no DMARC */ }

    try {
      const mx = await dns.resolveMx(domain);
      results.mxRecords = mx;
    } catch { /* no MX */ }

    return results;
  }

  private calculateScore(results: { spfRecord?: string; dkimPublicKey?: string; dmarcPolicy?: string; mxRecords?: object }): number {
    let score = 0;
    if (results.spfRecord) score += 30;
    if (results.dkimPublicKey) score += 30;
    if (results.dmarcPolicy) score += 25;
    if (results.mxRecords) score += 15;
    return score;
  }
}
