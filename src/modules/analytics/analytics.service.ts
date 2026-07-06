import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(workspaceId: string) {
    const [
      totalInboxes, warmedInboxes, activeInboxes,
      totalLeads, hotLeads, warmLeads,
      totalCampaigns, activeCampaigns,
      recentSends, totalOpens, totalReplies,
    ] = await Promise.all([
      this.prisma.inbox.count({ where: { workspaceId } }),
      this.prisma.inbox.count({ where: { workspaceId, status: 'WARMED' } }),
      this.prisma.inbox.count({ where: { workspaceId, status: { in: ['WARMING', 'WARMED'] } } }),
      this.prisma.lead.count({ where: { workspaceId } }),
      this.prisma.lead.count({ where: { workspaceId, intentScore: { gte: 85 } } }),
      this.prisma.lead.count({ where: { workspaceId, intentScore: { gte: 60, lt: 85 } } }),
      this.prisma.campaign.count({ where: { workspaceId } }),
      this.prisma.campaign.count({ where: { workspaceId, status: 'ACTIVE' } }),
      this.prisma.sentEmail.count({ where: { inbox: { workspaceId }, isWarmup: false } }),
      this.prisma.sentEmail.count({ where: { inbox: { workspaceId }, openedAt: { not: null } } }),
      this.prisma.sentEmail.count({ where: { inbox: { workspaceId }, repliedAt: { not: null } } }),
    ]);

    const avgHealthScore = await this.prisma.inbox.aggregate({
      where: { workspaceId },
      _avg: { healthScore: true },
    });

    return {
      inboxes: {
        total: totalInboxes,
        warmed: warmedInboxes,
        active: activeInboxes,
        avgHealth: Math.round(avgHealthScore._avg.healthScore ?? 0),
      },
      leads: {
        total: totalLeads,
        hot: hotLeads,
        warm: warmLeads,
        cold: totalLeads - hotLeads - warmLeads,
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
      },
      sending: {
        totalSent: recentSends,
        totalOpens,
        totalReplies,
        openRate: recentSends > 0 ? totalOpens / recentSends : 0,
        replyRate: recentSends > 0 ? totalReplies / recentSends : 0,
      },
    };
  }

  async getWarmupChartData(workspaceId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.warmupLog.findMany({
      where: { inbox: { workspaceId }, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    // Aggregate by date
    const byDate = logs.reduce<Record<string, { sent: number; received: number; inboxRate: number; count: number }>>((acc, log) => {
      const key = log.date.toISOString().split('T')[0];
      if (!acc[key]) acc[key] = { sent: 0, received: 0, inboxRate: 0, count: 0 };
      acc[key].sent += log.emailsSent;
      acc[key].received += log.emailsReceived;
      acc[key].inboxRate += log.inboxRate;
      acc[key].count++;
      return acc;
    }, {});

    return Object.entries(byDate).map(([date, data]) => ({
      date,
      sent: data.sent,
      received: data.received,
      inboxRate: data.count > 0 ? data.inboxRate / data.count : 0,
    }));
  }

  async getActivityFeed(workspaceId: string, limit = 20) {
    return this.prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: { select: { firstName: true, lastName: true, company: { select: { name: true } } } },
      },
    });
  }
}
