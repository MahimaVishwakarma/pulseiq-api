import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InboxStatus } from '@prisma/client';

export const WARMUP_QUEUE = 'warmup';

export interface WarmupJobData {
  inboxId: string;
  workspaceId: string;
  dayNumber: number;
}

@Injectable()
export class WarmupService {
  private readonly logger = new Logger(WarmupService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(WARMUP_QUEUE) private warmupQueue: Queue<WarmupJobData>,
  ) {}

  // Runs at 6AM UTC daily — schedules warmup sends for all active inboxes
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scheduleDaily() {
    this.logger.log('Scheduling daily warmup jobs...');

    const activeInboxes = await this.prisma.inbox.findMany({
      where: {
        status: { in: [InboxStatus.WARMING] },
        warmupEnabled: true,
      },
    });

    for (const inbox of activeInboxes) {
      const dayNumber = this.getDayNumber(inbox.warmupStartDate);

      await this.warmupQueue.add(
        'send-warmup',
        { inboxId: inbox.id, workspaceId: inbox.workspaceId, dayNumber },
        {
          delay: Math.floor(Math.random() * 3_600_000), // random delay up to 1h
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }

    this.logger.log(`Scheduled warmup for ${activeInboxes.length} inboxes`);
  }

  async getWarmupProgress(inboxId: string) {
    const logs = await this.prisma.warmupLog.findMany({
      where: { inboxId },
      orderBy: { date: 'asc' },
      take: 60,
    });

    const inbox = await this.prisma.inbox.findUnique({
      where: { id: inboxId },
      select: { warmupStartDate: true, warmupDayTarget: true, status: true, healthScore: true },
    });

    if (!inbox) return null;

    const dayNumber = this.getDayNumber(inbox.warmupStartDate);
    const progressPercent = inbox.warmupDayTarget
      ? Math.min(100, Math.round((dayNumber / inbox.warmupDayTarget) * 100))
      : 0;

    return {
      logs,
      dayNumber,
      target: inbox.warmupDayTarget,
      progressPercent,
      status: inbox.status,
      healthScore: inbox.healthScore,
    };
  }

  async getPoolStats(workspaceId: string) {
    const total = await this.prisma.warmupPoolMember.count({ where: { isActive: true } });
    const mine = await this.prisma.warmupPoolMember.count({
      where: { workspaceId, isActive: true },
    });
    return { totalPoolSize: total, yourContribution: mine };
  }

  async recordLog(inboxId: string, data: {
    emailsSent: number;
    emailsReceived: number;
    replyRate: number;
    inboxRate: number;
    spamRate: number;
  }) {
    const healthDelta = this.calculateHealthDelta(data);

    const [log] = await Promise.all([
      this.prisma.warmupLog.create({
        data: { inboxId, ...data, healthDelta },
      }),
      this.prisma.inbox.update({
        where: { id: inboxId },
        data: { healthScore: { increment: healthDelta } },
      }),
    ]);

    // Check if warmup target reached
    const inbox = await this.prisma.inbox.findUnique({ where: { id: inboxId } });
    if (inbox && inbox.healthScore >= 100) {
      await this.prisma.inbox.update({
        where: { id: inboxId },
        data: { status: InboxStatus.WARMED, warmupCompletedAt: new Date() },
      });
    }

    return log;
  }

  private getDayNumber(startDate: Date | null): number {
    if (!startDate) return 0;
    return Math.floor((Date.now() - startDate.getTime()) / 86_400_000) + 1;
  }

  private calculateHealthDelta(data: { inboxRate: number; spamRate: number; replyRate: number }): number {
    let delta = 0;
    if (data.inboxRate > 0.95) delta += 3;
    else if (data.inboxRate > 0.85) delta += 1;
    if (data.spamRate < 0.02) delta += 2;
    else if (data.spamRate > 0.1) delta -= 5;
    if (data.replyRate > 0.2) delta += 2;
    return delta;
  }
}
