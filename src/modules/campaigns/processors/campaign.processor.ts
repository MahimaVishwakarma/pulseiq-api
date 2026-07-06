import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CAMPAIGN_QUEUE, CampaignJobData } from '../campaigns.service';

@Processor(CAMPAIGN_QUEUE)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(CAMPAIGN_QUEUE) private campaignQueue: Queue<CampaignJobData>,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId, leadId, stepId, inboxId } = job.data;

    const [step, lead] = await Promise.all([
      this.prisma.campaignStep.findUnique({ where: { id: stepId } }),
      this.prisma.lead.findUnique({ where: { id: leadId } }),
    ]);

    if (!step || !lead) return;

    if (step.type === 'EMAIL') {
      await this.sendEmail(campaignId, leadId, stepId, inboxId, step, lead);
    } else if (step.type === 'DELAY') {
      // Delay handled via queue scheduling
      this.logger.log(`Delay step processed for lead ${leadId}`);
    } else if (step.type === 'CONDITION') {
      await this.evaluateCondition(campaignId, leadId, stepId, inboxId, step);
    }

    // Schedule next step
    await this.scheduleNextStep(campaignId, leadId, stepId, inboxId);
  }

  private async sendEmail(
    campaignId: string,
    leadId: string,
    stepId: string,
    inboxId: string,
    step: { subject?: string | null; body?: string | null },
    lead: { firstName?: string | null; lastName?: string | null; email?: string | null },
  ) {
    if (!lead.email || !step.body) return;

    const personalizedSubject = this.personalize(step.subject ?? '', lead);
    const personalizedBody = this.personalize(step.body, lead);

    // Record the send
    const send = await this.prisma.campaignStepSend.create({
      data: {
        stepId,
        inboxId,
        scheduledAt: new Date(),
        sentAt: new Date(),
        status: 'sent',
      },
    });

    await this.prisma.sentEmail.create({
      data: {
        subject: personalizedSubject,
        toEmail: lead.email,
        inboxId,
        isWarmup: false,
        campaignStepSendId: send.id,
      },
    });

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalSent: { increment: 1 } },
    });

    this.logger.log(`Sent campaign email to ${lead.email}`);
  }

  private async evaluateCondition(
    campaignId: string,
    leadId: string,
    _stepId: string,
    inboxId: string,
    step: { conditionType?: string | null; id: string; order: number },
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!campaign) return;

    const currentStepIndex = campaign.steps.findIndex((s) => s.id === step.id);
    const nextStep = campaign.steps[currentStepIndex + 1];
    if (!nextStep) return;

    // Simplified: always take the "yes" branch
    const delayMs = (nextStep.delayDays ?? 0) * 86400000 + (nextStep.delayHours ?? 0) * 3600000;
    await this.campaignQueue.add(
      'send-step',
      { campaignId, leadId, stepId: nextStep.id, inboxId },
      { delay: delayMs, attempts: 3 },
    );
  }

  private async scheduleNextStep(
    campaignId: string,
    leadId: string,
    currentStepId: string,
    inboxId: string,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!campaign) return;

    const idx = campaign.steps.findIndex((s) => s.id === currentStepId);
    const next = campaign.steps[idx + 1];
    if (!next) return;

    const delayMs = (next.delayDays ?? 1) * 86400000 + (next.delayHours ?? 0) * 3600000;

    if (next.type !== 'CONDITION') {
      await this.campaignQueue.add(
        'send-step',
        { campaignId, leadId, stepId: next.id, inboxId },
        { delay: delayMs, attempts: 3 },
      );
    }
  }

  private personalize(template: string, lead: { firstName?: string | null; lastName?: string | null }): string {
    return template
      .replace(/\{\{firstName\}\}/g, lead.firstName ?? 'there')
      .replace(/\{\{lastName\}\}/g, lead.lastName ?? '')
      .replace(/\{\{fullName\}\}/g, `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim());
  }
}
