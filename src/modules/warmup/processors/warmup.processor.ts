import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WarmupService, WARMUP_QUEUE, WarmupJobData } from '../warmup.service';
import { ConfigService } from '@nestjs/config';
import { decrypt } from '../../../common/utils/crypto.util';
import * as nodemailer from 'nodemailer';

const WARMUP_SUBJECTS = [
  'Quick follow-up',
  'Checking in',
  'Wanted to share something',
  'Hope you are well',
  "Let's connect",
  'Thoughts on this?',
  'A quick question',
];

const WARMUP_BODIES = [
  'Hope you are having a great week! Just reaching out to touch base.',
  'I wanted to follow up on our previous conversation. Let me know if you have any thoughts!',
  'Sharing something I thought might be useful — happy to chat if you would like to discuss.',
  "Just checking in! Let me know how things are going on your end.",
];

@Processor(WARMUP_QUEUE)
export class WarmupProcessor extends WorkerHost {
  private readonly logger = new Logger(WarmupProcessor.name);

  constructor(
    private prisma: PrismaService,
    private warmupService: WarmupService,
    private config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<WarmupJobData>): Promise<void> {
    const { inboxId, dayNumber } = job.data;

    const inbox = await this.prisma.inbox.findUnique({ where: { id: inboxId } });
    if (!inbox || !inbox.warmupEnabled) return;

    // Find a pool partner to exchange with
    const partner = await this.prisma.warmupPoolMember.findFirst({
      where: { isActive: true, inboxId: { not: inboxId } },
      include: { inbox: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!partner) {
      this.logger.warn(`No pool partner found for inbox ${inboxId}`);
      return;
    }

    // Calculate send volume for today (ramp up schedule)
    const dailySends = Math.min(Math.floor(dayNumber * 1.5) + 2, inbox.dailySendLimit);
    let sent = 0;
    let received = 0;
    let spamCount = 0;

    const encKey = this.config.get<string>('encryption.key') ?? '';

    for (let i = 0; i < dailySends; i++) {
      try {
        const transporter = await this.createTransporter(inbox, encKey);
        const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)];
        const body = WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)];

        await transporter.sendMail({
          from: `${inbox.displayName ?? inbox.email} <${inbox.email}>`,
          to: partner.inbox.email,
          subject,
          text: body,
        });

        sent++;
        // Simulate partner reply (in production, this is handled by inbound webhook)
        if (Math.random() > 0.4) received++;
        if (Math.random() < 0.02) spamCount++;
      } catch (err) {
        this.logger.error(`Failed to send warmup email from ${inbox.email}: ${String(err)}`);
      }
    }

    const replyRate = sent > 0 ? received / sent : 0;
    const spamRate = sent > 0 ? spamCount / sent : 0;
    const inboxRate = 1 - spamRate;

    await this.warmupService.recordLog(inboxId, {
      emailsSent: sent,
      emailsReceived: received,
      replyRate,
      inboxRate,
      spamRate,
    });

    this.logger.log(`Warmup day ${dayNumber} for ${inbox.email}: sent=${sent} received=${received}`);
  }

  private async createTransporter(inbox: { smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPassEnc?: string | null; provider: string }, encKey: string) {
    if (inbox.provider === 'custom_smtp' && inbox.smtpHost && inbox.smtpPassEnc) {
      const pass = decrypt(inbox.smtpPassEnc, encKey);
      return nodemailer.createTransport({
        host: inbox.smtpHost,
        port: inbox.smtpPort ?? 587,
        secure: (inbox.smtpPort ?? 587) === 465,
        auth: { user: inbox.smtpUser ?? '', pass },
      });
    }

    // For Gmail / Outlook — use OAuth2 (simplified; production uses real OAuth flow)
    throw new Error(`OAuth transporter not yet implemented for provider: ${inbox.provider}`);
  }
}
