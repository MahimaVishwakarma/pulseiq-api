import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic;
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: config.get<string>('anthropic.apiKey') ?? '',
    });
    this.openai = new OpenAI({
      apiKey: config.get<string>('openai.apiKey') ?? '',
    });
  }

  async copilot(workspaceId: string, query: string): Promise<string> {
    // Fetch workspace context
    const [stats, recentLeads] = await Promise.all([
      this.getWorkspaceContext(workspaceId),
      this.prisma.lead.findMany({
        where: { workspaceId },
        orderBy: { intentScore: 'desc' },
        take: 5,
        include: { company: true },
      }),
    ]);

    const systemPrompt = `You are PulseIQ AI Copilot, an expert email deliverability and sales intelligence assistant.

Workspace context:
- Inboxes: ${stats.inboxes.total} total, ${stats.inboxes.warmed} warmed
- Leads: ${stats.leads.total} total, ${stats.leads.hot} hot (score ≥85)
- Campaigns: ${stats.campaigns.total} total

Top leads: ${recentLeads.map((l) => `${l.firstName} ${l.lastName} at ${l.company?.name ?? 'unknown'} (score: ${l.intentScore})`).join(', ')}

Answer concisely and actionably. Focus on deliverability, lead prioritization, and revenue impact.`;

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    });

    return (message.content[0] as { text: string }).text;
  }

  async rewriteEmail(subject: string, body: string, tone: 'professional' | 'casual' | 'persuasive' = 'professional'): Promise<{ subject: string; body: string }> {
    const prompt = `Rewrite this cold email to be more ${tone} and effective. Keep it under 150 words. Improve the subject line too.

Subject: ${subject}
Body: ${body}

Return JSON: {"subject": "...", "body": "..."}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as { subject: string; body: string };
    return { subject, body };
  }

  async generateAbVariants(subject: string, body: string): Promise<Array<{ subject: string; body: string; label: string }>> {
    const prompt = `Create 2 A/B test variants for this email. Return JSON array: [{"label":"A","subject":"...","body":"..."},{"label":"B","subject":"...","body":"..."}]

Original subject: ${subject}
Original body: ${body}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as Array<{ subject: string; body: string; label: string }>;
    return [];
  }

  async scoreSpam(subject: string, body: string): Promise<{ score: number; issues: string[]; suggestions: string[] }> {
    const prompt = `Analyze this email for spam triggers. Score 0-100 (0=spam, 100=clean inbox). Return JSON:
{"score": 85, "issues": ["excessive caps", "spam word: FREE"], "suggestions": ["Remove caps", "Replace FREE with complimentary"]}

Subject: ${subject}
Body: ${body}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as { score: number; issues: string[]; suggestions: string[] };
    return { score: 70, issues: [], suggestions: [] };
  }

  async generateLeadInsight(workspaceId: string, leadId: string): Promise<string> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: { company: true, signals: true, deals: true },
    });

    if (!lead) return 'Lead not found.';

    const prompt = `Generate a brief (3-4 sentence) sales insight for this lead. Focus on why they're a hot prospect and the best outreach angle.

Lead: ${lead.firstName} ${lead.lastName}, ${lead.title} at ${lead.company?.name ?? 'Unknown Company'}
Company: ${lead.company?.industry ?? 'N/A'}, ${lead.company?.revenue ?? 'N/A'} revenue, ${lead.company?.employeeCount ?? 'N/A'} employees
Intent score: ${lead.intentScore}/100
Recent signals: ${lead.signals.map((s) => s.description).slice(0, 3).join('; ')}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    return (message.content[0] as { text: string }).text;
  }

  async generateDeliverabilityInsights(workspaceId: string): Promise<Array<{
    type: string; title: string; body: string; priority: string;
  }>> {
    const inboxes = await this.prisma.inbox.findMany({
      where: { workspaceId },
      include: { warmupLogs: { orderBy: { date: 'desc' }, take: 7 } },
    });

    const atRisk = inboxes.filter((i) => i.status === 'AT_RISK');
    const avgHealth = inboxes.reduce((sum, i) => sum + i.healthScore, 0) / (inboxes.length || 1);

    const insights: Array<{ type: string; title: string; body: string; priority: string }> = [];

    if (atRisk.length > 0) {
      insights.push({
        type: 'deliverability',
        title: `${atRisk.length} inbox${atRisk.length > 1 ? 'es' : ''} at risk`,
        body: `${atRisk.map((i) => i.email).join(', ')} show declining inbox placement. Consider pausing campaigns and increasing warmup activity.`,
        priority: 'high',
      });
    }

    if (avgHealth < 60) {
      insights.push({
        type: 'deliverability',
        title: 'Low average inbox health score',
        body: `Your inboxes average a health score of ${Math.round(avgHealth)}/100. Review DNS configuration and reduce daily send volume.`,
        priority: 'medium',
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'deliverability',
        title: 'Inbox health looking good',
        body: `All ${inboxes.length} inboxes are performing well with an average health score of ${Math.round(avgHealth)}/100.`,
        priority: 'low',
      });
    }

    // Store insights
    await this.prisma.aiInsight.createMany({
      data: insights.map((i) => ({ ...i, workspaceId })),
    });

    return insights;
  }

  async getInsights(workspaceId: string) {
    return this.prisma.aiInsight.findMany({
      where: { workspaceId, dismissed: false },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
  }

  async dismissInsight(workspaceId: string, insightId: string) {
    return this.prisma.aiInsight.updateMany({
      where: { id: insightId, workspaceId },
      data: { dismissed: true },
    });
  }

  private async getWorkspaceContext(workspaceId: string) {
    const [inboxTotal, inboxWarmed, leadTotal, leadHot, campaignTotal] = await Promise.all([
      this.prisma.inbox.count({ where: { workspaceId } }),
      this.prisma.inbox.count({ where: { workspaceId, status: 'WARMED' } }),
      this.prisma.lead.count({ where: { workspaceId } }),
      this.prisma.lead.count({ where: { workspaceId, intentScore: { gte: 85 } } }),
      this.prisma.campaign.count({ where: { workspaceId } }),
    ]);
    return {
      inboxes: { total: inboxTotal, warmed: inboxWarmed },
      leads: { total: leadTotal, hot: leadHot },
      campaigns: { total: campaignTotal },
    };
  }
}
