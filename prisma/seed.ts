import { PrismaClient, InboxStatus, DomainStatus, LeadStage, SignalType, CampaignStatus, ActivityType, DealStage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PulseIQ database...');

  // ── Workspace ──────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      id: 'demo-workspace',
      name: 'Acme Corp',
      slug: 'acme-corp',
      industry: 'SaaS',
      website: 'https://acmecorp.io',
      planTier: 'GROWTH',
      maxInboxes: 25,
      maxLeads: 5000,
      maxCampaigns: 20,
    },
  });

  // ── User ───────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'mahima@acmecorp.io' },
    update: {},
    create: {
      id: 'demo-user',
      clerkId: 'user_seed_001',
      email: 'mahima@acmecorp.io',
      firstName: 'Mahima',
      lastName: 'V.',
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: 'ADMIN' },
  });

  // ── Domain ─────────────────────────────────────────────────
  const domain = await prisma.domain.upsert({
    where: { workspaceId_domain: { workspaceId: workspace.id, domain: 'acmecorp.io' } },
    update: {},
    create: {
      domain: 'acmecorp.io',
      workspaceId: workspace.id,
      status: DomainStatus.VERIFIED,
      spfRecord: 'v=spf1 include:_spf.google.com ~all',
      dkimSelector: 'google',
      dmarcPolicy: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@acmecorp.io',
      healthScore: 92,
      lastCheckedAt: new Date(),
    },
  });

  // ── Inboxes ────────────────────────────────────────────────
  const inboxData = [
    { email: 'alex@acmecorp.io', displayName: 'Alex Chen', status: InboxStatus.WARMED, healthScore: 96, reputationScore: 94, dailySendLimit: 150 },
    { email: 'sarah@acmecorp.io', displayName: 'Sarah Kim', status: InboxStatus.WARMED, healthScore: 91, reputationScore: 89, dailySendLimit: 120 },
    { email: 'outreach@acmecorp.io', displayName: 'Outreach Team', status: InboxStatus.WARMING, healthScore: 72, reputationScore: 68, dailySendLimit: 80 },
    { email: 'james@acmecorp.io', displayName: 'James Park', status: InboxStatus.WARMING, healthScore: 58, reputationScore: 55, dailySendLimit: 60 },
    { email: 'hello@acmecorp.io', displayName: 'Hello Acme', status: InboxStatus.AT_RISK, healthScore: 34, reputationScore: 30, dailySendLimit: 30 },
    { email: 'ceo@acmecorp.io', displayName: 'CEO Acme', status: InboxStatus.PAUSED, healthScore: 62, reputationScore: 60, dailySendLimit: 50 },
    { email: 'bd@acmecorp.io', displayName: 'BD Team', status: InboxStatus.IDLE, healthScore: 45, reputationScore: 43, dailySendLimit: 40 },
    { email: 'sales@acmecorp.io', displayName: 'Sales Acme', status: InboxStatus.WARMING, healthScore: 65, reputationScore: 63, dailySendLimit: 70 },
  ];

  const inboxes = [];
  for (const d of inboxData) {
    const inbox = await prisma.inbox.upsert({
      where: { workspaceId_email: { workspaceId: workspace.id, email: d.email } },
      update: {},
      create: {
        ...d,
        provider: 'gmail',
        workspaceId: workspace.id,
        domainId: domain.id,
        spfValid: true,
        dkimValid: true,
        dmarcValid: true,
        warmupEnabled: d.status === 'WARMING' || d.status === 'WARMED',
        warmupStartDate: new Date(Date.now() - 15 * 86400000),
        warmupDayTarget: 21,
        lastCheckedAt: new Date(),
      },
    });
    inboxes.push(inbox);

    // Warmup logs (last 30 days)
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const dayScore = Math.max(0, d.healthScore - i * 2 + Math.random() * 5);
      await prisma.warmupLog.create({
        data: {
          inboxId: inbox.id,
          date,
          emailsSent: Math.floor(5 + (30 - i) * 0.8 + Math.random() * 3),
          emailsReceived: Math.floor(3 + (30 - i) * 0.6 + Math.random() * 2),
          replyRate: 0.3 + Math.random() * 0.2,
          inboxRate: Math.min(1, 0.85 + Math.random() * 0.12),
          spamRate: Math.max(0, 0.02 - i * 0.001 + Math.random() * 0.01),
          healthDelta: Math.floor(dayScore / 10),
        },
      });
    }

    // Pool membership for active inboxes
    if (d.status === 'WARMED' || d.status === 'WARMING') {
      await prisma.warmupPoolMember.upsert({
        where: { inboxId: inbox.id },
        update: {},
        create: { inboxId: inbox.id, workspaceId: workspace.id, isActive: true },
      });
    }
  }

  // ── Companies ──────────────────────────────────────────────
  const companiesData = [
    { name: 'Stripe', domain: 'stripe.com', industry: 'Fintech', employeeCount: '8,000+', revenue: '$2.1B ARR', funding: '$2.1B total raised', techStack: ['Salesforce', 'Outreach', 'Slack', 'Zoom', 'Calendly', 'LinkedIn Sales Nav'] },
    { name: 'Brex', domain: 'brex.com', industry: 'Fintech', employeeCount: '1,200+', revenue: '$300M ARR', funding: '$1.5B total raised', techStack: ['HubSpot', 'Gong', 'Slack', 'Notion'] },
    { name: 'Rippling', domain: 'rippling.com', industry: 'HR Tech', employeeCount: '2,500+', revenue: '$350M ARR', funding: '$1.2B total raised', techStack: ['Salesforce', 'Outreach', 'Slack', 'Zoom'] },
    { name: 'Vercel', domain: 'vercel.com', industry: 'Developer Tools', employeeCount: '500+', revenue: '$100M ARR', funding: '$313M total raised', techStack: ['HubSpot', 'Slack', 'Linear', 'Figma'] },
    { name: 'Linear', domain: 'linear.app', industry: 'SaaS', employeeCount: '100+', revenue: '$20M ARR', funding: '$52M total raised', techStack: ['Intercom', 'Slack', 'Figma'] },
    { name: 'Notion', domain: 'notion.so', industry: 'Productivity', employeeCount: '400+', revenue: '$150M ARR', funding: '$343M total raised', techStack: ['Salesforce', 'Intercom', 'Slack'] },
    { name: 'Retool', domain: 'retool.com', industry: 'Developer Tools', employeeCount: '300+', revenue: '$80M ARR', funding: '$145M total raised', techStack: ['HubSpot', 'Slack', 'GitHub'] },
    { name: 'Figma', domain: 'figma.com', industry: 'Design', employeeCount: '800+', revenue: '$400M ARR', funding: '$333M total raised', techStack: ['Salesforce', 'Zendesk', 'Slack'] },
    // ── Broad industry coverage ──
    { name: 'Oscar Health', domain: 'hioscar.com', industry: 'Healthcare', employeeCount: '3,000+', revenue: '$6B ARR', funding: 'Public', techStack: ['Salesforce', 'Zendesk', 'Slack'] },
    { name: 'Tempus Labs', domain: 'tempus.com', industry: 'Biotech', employeeCount: '2,000+', revenue: '$500M ARR', funding: '$1.3B total raised', techStack: ['HubSpot', 'Slack', 'Tableau'] },
    { name: 'Shopify Plus Agency Co', domain: 'plusagency.io', industry: 'E-commerce', employeeCount: '150+', revenue: '$25M ARR', funding: 'Bootstrapped', techStack: ['Shopify', 'Klaviyo', 'Gorgias'] },
    { name: 'Faire', domain: 'faire.com', industry: 'Retail', employeeCount: '1,000+', revenue: '$800M GMV', funding: '$1.7B total raised', techStack: ['Salesforce', 'Outreach', 'Looker'] },
    { name: 'Compass', domain: 'compass.com', industry: 'Real Estate', employeeCount: '4,500+', revenue: '$6B ARR', funding: 'Public', techStack: ['Salesforce', 'Slack', 'DocuSign'] },
    { name: 'Procore', domain: 'procore.com', industry: 'Construction', employeeCount: '3,500+', revenue: '$900M ARR', funding: 'Public', techStack: ['Salesforce', 'Gong', 'Slack'] },
    { name: 'Samsara', domain: 'samsara.com', industry: 'Logistics', employeeCount: '2,500+', revenue: '$1B ARR', funding: 'Public', techStack: ['Salesforce', 'Outreach', 'Slack'] },
    { name: 'Flexport', domain: 'flexport.com', industry: 'Supply Chain', employeeCount: '2,000+', revenue: '$3B ARR', funding: '$2.3B total raised', techStack: ['Salesforce', 'Slack', 'Looker'] },
    { name: 'Toast', domain: 'toasttab.com', industry: 'Hospitality', employeeCount: '5,000+', revenue: '$4B ARR', funding: 'Public', techStack: ['Salesforce', 'Gong', 'Slack'] },
    { name: 'Sweetgreen', domain: 'sweetgreen.com', industry: 'Food & Beverage', employeeCount: '6,000+', revenue: '$700M ARR', funding: 'Public', techStack: ['HubSpot', 'Slack', 'Tableau'] },
    { name: 'Duolingo', domain: 'duolingo.com', industry: 'Education', employeeCount: '800+', revenue: '$750M ARR', funding: 'Public', techStack: ['HubSpot', 'Slack', 'Amplitude'] },
    { name: 'Clio', domain: 'clio.com', industry: 'Legal', employeeCount: '1,200+', revenue: '$200M ARR', funding: '$1.3B total raised', techStack: ['Salesforce', 'Gong', 'Slack'] },
    { name: 'Gusto', domain: 'gusto.com', industry: 'HR Services', employeeCount: '2,500+', revenue: '$500M ARR', funding: '$746M total raised', techStack: ['Salesforce', 'Outreach', 'Slack'] },
    { name: 'Lemonade', domain: 'lemonade.com', industry: 'Insurance', employeeCount: '1,300+', revenue: '$480M ARR', funding: 'Public', techStack: ['HubSpot', 'Slack', 'Looker'] },
    { name: 'Arcadia Power', domain: 'arcadia.com', industry: 'Energy', employeeCount: '400+', revenue: '$120M ARR', funding: '$380M total raised', techStack: ['Salesforce', 'Slack', 'Tableau'] },
    { name: 'John Deere Dealer Net', domain: 'deere-partners.com', industry: 'Agriculture', employeeCount: '900+', revenue: '$250M ARR', funding: 'Private', techStack: ['Salesforce', 'SAP', 'Teams'] },
    { name: 'Rivian Fleet', domain: 'rivian.com', industry: 'Automotive', employeeCount: '14,000+', revenue: '$4.4B ARR', funding: 'Public', techStack: ['Salesforce', 'Slack', 'Tableau'] },
    { name: 'CrowdStrike', domain: 'crowdstrike.com', industry: 'Cybersecurity', employeeCount: '8,000+', revenue: '$3B ARR', funding: 'Public', techStack: ['Salesforce', 'Outreach', 'Gong'] },
    { name: 'Twilio', domain: 'twilio.com', industry: 'Telecom', employeeCount: '5,500+', revenue: '$4B ARR', funding: 'Public', techStack: ['Salesforce', 'Outreach', 'Slack'] },
    { name: 'A24 Films', domain: 'a24films.com', industry: 'Media & Entertainment', employeeCount: '250+', revenue: '$500M ARR', funding: 'Private', techStack: ['HubSpot', 'Slack', 'Airtable'] },
    { name: 'Epic Games Partners', domain: 'epicgames.com', industry: 'Gaming', employeeCount: '4,000+', revenue: '$5.6B ARR', funding: '$7.7B total raised', techStack: ['Salesforce', 'Slack', 'Tableau'] },
    { name: 'Hopper', domain: 'hopper.com', industry: 'Travel', employeeCount: '1,500+', revenue: '$600M ARR', funding: '$740M total raised', techStack: ['HubSpot', 'Slack', 'Amplitude'] },
    { name: 'Ogilvy Digital', domain: 'ogilvy.com', industry: 'Marketing Agency', employeeCount: '10,000+', revenue: '$2B ARR', funding: 'Private', techStack: ['HubSpot', 'Slack', 'Sprinklr'] },
    { name: 'Robert Half Tech', domain: 'roberthalf.com', industry: 'Recruiting', employeeCount: '11,000+', revenue: '$6.4B ARR', funding: 'Public', techStack: ['Salesforce', 'Bullhorn', 'Teams'] },
    { name: 'Charity: Water', domain: 'charitywater.org', industry: 'Nonprofit', employeeCount: '150+', revenue: '$100M raised/yr', funding: 'Donor-funded', techStack: ['Salesforce NPSP', 'Slack', 'Classy'] },
    { name: 'Anduril', domain: 'anduril.com', industry: 'Defense & Aerospace', employeeCount: '3,500+', revenue: '$1B ARR', funding: '$3.7B total raised', techStack: ['Salesforce', 'Slack', 'Palantir'] },
  ];

  const companies = [];
  for (const c of companiesData) {
    const company = await prisma.company.upsert({
      where: { id: `seed-co-${c.domain}` },
      update: {},
      create: {
        id: `seed-co-${c.domain}`,
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        employeeCount: c.employeeCount,
        revenue: c.revenue,
        funding: c.funding,
        techStack: c.techStack,
        enrichedAt: new Date(),
      },
    });
    companies.push(company);
  }

  // ── Leads ──────────────────────────────────────────────────
  const leadsData = [
    { firstName: 'Marcus', lastName: 'Webb', email: 'marcus.webb@stripe.com', phone: '+1 (415) 555-0142', linkedinUrl: 'linkedin.com/in/marcuswebb', title: 'VP of Sales', department: 'Sales', intentScore: 96, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 0 },
    { firstName: 'Lisa', lastName: 'Chen', email: 'lisa.chen@brex.com', phone: '+1 (650) 555-0198', linkedinUrl: 'linkedin.com/in/lisachen', title: 'Head of Revenue', department: 'Revenue', intentScore: 88, signalType: SignalType.HOT, stage: LeadStage.CONTACTED, companyIdx: 1 },
    { firstName: 'Jordan', lastName: 'Kim', email: 'jordan.kim@rippling.com', phone: '+1 (628) 555-0167', linkedinUrl: 'linkedin.com/in/jordankim', title: 'CRO', department: 'Executive', intentScore: 79, signalType: SignalType.WARM, stage: LeadStage.RESEARCHING, companyIdx: 2 },
    { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@vercel.com', phone: '+1 (415) 555-0134', linkedinUrl: 'linkedin.com/in/priyasharma', title: 'Director of Growth', department: 'Growth', intentScore: 74, signalType: SignalType.WARM, stage: LeadStage.NEW, companyIdx: 3 },
    { firstName: 'Alex', lastName: 'Turner', email: 'alex.turner@linear.app', phone: '+1 (510) 555-0189', linkedinUrl: 'linkedin.com/in/alexturner', title: 'VP Marketing', department: 'Marketing', intentScore: 67, signalType: SignalType.WARM, stage: LeadStage.NEW, companyIdx: 4 },
    { firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@notion.so', phone: '+1 (415) 555-0112', linkedinUrl: 'linkedin.com/in/samrivera', title: 'Head of Sales', department: 'Sales', intentScore: 61, signalType: SignalType.WARM, stage: LeadStage.NEW, companyIdx: 5 },
    { firstName: 'Taylor', lastName: 'Brooks', email: 'taylor.brooks@retool.com', phone: '+1 (650) 555-0145', linkedinUrl: 'linkedin.com/in/taylorbrooks', title: 'Enterprise AE', department: 'Sales', intentScore: 52, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 6 },
    { firstName: 'Morgan', lastName: 'Hayes', email: 'morgan.hayes@figma.com', phone: '+1 (415) 555-0178', linkedinUrl: 'linkedin.com/in/morganhayes', title: 'Director of Sales', department: 'Sales', intentScore: 45, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 7 },
    // ── Broad industry coverage ──
    { firstName: 'Elena', lastName: 'Vasquez', email: 'elena.vasquez@hioscar.com', phone: '+1 (212) 555-0231', linkedinUrl: 'linkedin.com/in/elenavasquez', title: 'VP Provider Partnerships', department: 'Partnerships', intentScore: 91, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 8 },
    { firstName: 'David', lastName: 'Okonkwo', email: 'david.okonkwo@tempus.com', phone: '+1 (312) 555-0187', linkedinUrl: 'linkedin.com/in/davidokonkwo', title: 'Director of BD', department: 'Business Development', intentScore: 72, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 9 },
    { firstName: 'Chloe', lastName: 'Bennett', email: 'chloe@plusagency.io', phone: '+1 (646) 555-0119', linkedinUrl: 'linkedin.com/in/chloebennett', title: 'Founder & CEO', department: 'Executive', intentScore: 84, signalType: SignalType.HOT, stage: LeadStage.RESEARCHING, companyIdx: 10 },
    { firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@faire.com', phone: '+1 (415) 555-0263', linkedinUrl: 'linkedin.com/in/rajpatel', title: 'Head of Merchant Growth', department: 'Growth', intentScore: 66, signalType: SignalType.WARM, stage: LeadStage.NEW, companyIdx: 11 },
    { firstName: 'Sofia', lastName: 'Marino', email: 'sofia.marino@compass.com', phone: '+1 (917) 555-0148', linkedinUrl: 'linkedin.com/in/sofiamarino', title: 'Regional Sales Director', department: 'Sales', intentScore: 89, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 12 },
    { firstName: 'Hank', lastName: 'Dawson', email: 'hank.dawson@procore.com', phone: '+1 (805) 555-0172', linkedinUrl: 'linkedin.com/in/hankdawson', title: 'VP Field Sales', department: 'Sales', intentScore: 58, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 13 },
    { firstName: 'Ingrid', lastName: 'Larsen', email: 'ingrid.larsen@samsara.com', phone: '+1 (415) 555-0295', linkedinUrl: 'linkedin.com/in/ingridlarsen', title: 'Director Fleet Solutions', department: 'Sales', intentScore: 77, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 14 },
    { firstName: 'Omar', lastName: 'Haddad', email: 'omar.haddad@flexport.com', phone: '+1 (415) 555-0316', linkedinUrl: 'linkedin.com/in/omarhaddad', title: 'Head of Enterprise Logistics', department: 'Operations', intentScore: 70, signalType: SignalType.WARM, stage: LeadStage.RESEARCHING, companyIdx: 15 },
    { firstName: 'Nina', lastName: 'Rossi', email: 'nina.rossi@toasttab.com', phone: '+1 (617) 555-0154', linkedinUrl: 'linkedin.com/in/ninarossi', title: 'VP Restaurant Success', department: 'Customer Success', intentScore: 93, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 16 },
    { firstName: 'Miguel', lastName: 'Santos', email: 'miguel.santos@sweetgreen.com', phone: '+1 (310) 555-0228', linkedinUrl: 'linkedin.com/in/miguelsantos', title: 'Director Corporate Catering', department: 'Sales', intentScore: 49, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 17 },
    { firstName: 'Hannah', lastName: 'Weiss', email: 'hannah.weiss@duolingo.com', phone: '+1 (412) 555-0183', linkedinUrl: 'linkedin.com/in/hannahweiss', title: 'Head of B2B Partnerships', department: 'Partnerships', intentScore: 63, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 18 },
    { firstName: 'Trevor', lastName: 'MacLeod', email: 'trevor.macleod@clio.com', phone: '+1 (604) 555-0137', linkedinUrl: 'linkedin.com/in/trevormacleod', title: 'VP Sales', department: 'Sales', intentScore: 81, signalType: SignalType.HOT, stage: LeadStage.RESEARCHING, companyIdx: 19 },
    { firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@gusto.com', phone: '+1 (415) 555-0242', linkedinUrl: 'linkedin.com/in/aishamohammed', title: 'Head of SMB Sales', department: 'Sales', intentScore: 69, signalType: SignalType.WARM, stage: LeadStage.NEW, companyIdx: 20 },
    { firstName: 'Felix', lastName: 'Brandt', email: 'felix.brandt@lemonade.com', phone: '+1 (646) 555-0197', linkedinUrl: 'linkedin.com/in/felixbrandt', title: 'Director Growth Marketing', department: 'Marketing', intentScore: 55, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 21 },
    { firstName: 'Gabriela', lastName: 'Fuentes', email: 'gabriela.fuentes@arcadia.com', phone: '+1 (202) 555-0164', linkedinUrl: 'linkedin.com/in/gabrielafuentes', title: 'VP Utility Partnerships', department: 'Partnerships', intentScore: 76, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 22 },
    { firstName: 'Wyatt', lastName: 'Coleman', email: 'wyatt.coleman@deere-partners.com', phone: '+1 (309) 555-0121', linkedinUrl: 'linkedin.com/in/wyattcoleman', title: 'Dealer Network Director', department: 'Sales', intentScore: 42, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 23 },
    { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@rivian.com', phone: '+1 (949) 555-0276', linkedinUrl: 'linkedin.com/in/yukitanaka', title: 'Head of Fleet Sales', department: 'Sales', intentScore: 87, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 24 },
    { firstName: 'Marcus', lastName: 'Thorne', email: 'marcus.thorne@crowdstrike.com', phone: '+1 (512) 555-0209', linkedinUrl: 'linkedin.com/in/marcusthorne', title: 'VP Channel Sales', department: 'Sales', intentScore: 94, signalType: SignalType.HOT, stage: LeadStage.ENGAGED, companyIdx: 25 },
    { firstName: 'Leila', lastName: 'Nasser', email: 'leila.nasser@twilio.com', phone: '+1 (415) 555-0331', linkedinUrl: 'linkedin.com/in/leilanasser', title: 'Director ISV Partnerships', department: 'Partnerships', intentScore: 60, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 26 },
    { firstName: 'Jack', lastName: 'Sullivan', email: 'jack.sullivan@a24films.com', phone: '+1 (212) 555-0288', linkedinUrl: 'linkedin.com/in/jacksullivan', title: 'Head of Brand Partnerships', department: 'Partnerships', intentScore: 51, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 27 },
    { firstName: 'Zoe', lastName: 'Ashford', email: 'zoe.ashford@epicgames.com', phone: '+1 (919) 555-0173', linkedinUrl: 'linkedin.com/in/zoeashford', title: 'Director Developer Relations', department: 'Partnerships', intentScore: 68, signalType: SignalType.WARM, stage: LeadStage.RESEARCHING, companyIdx: 28 },
    { firstName: 'Pierre', lastName: 'Dubois', email: 'pierre.dubois@hopper.com', phone: '+1 (514) 555-0146', linkedinUrl: 'linkedin.com/in/pierredubois', title: 'VP Supply Growth', department: 'Growth', intentScore: 73, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 29 },
    { firstName: 'Tara', lastName: "O'Connell", email: 'tara.oconnell@ogilvy.com', phone: '+1 (212) 555-0319', linkedinUrl: 'linkedin.com/in/taraoconnell', title: 'Managing Director, Digital', department: 'Executive', intentScore: 83, signalType: SignalType.HOT, stage: LeadStage.RESEARCHING, companyIdx: 30 },
    { firstName: 'Dmitri', lastName: 'Volkov', email: 'dmitri.volkov@roberthalf.com', phone: '+1 (650) 555-0252', linkedinUrl: 'linkedin.com/in/dmitrivolkov', title: 'VP Technology Staffing', department: 'Sales', intentScore: 57, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 31 },
    { firstName: 'Grace', lastName: 'Adeyemi', email: 'grace.adeyemi@charitywater.org', phone: '+1 (646) 555-0165', linkedinUrl: 'linkedin.com/in/graceadeyemi', title: 'Director Corporate Giving', department: 'Development', intentScore: 47, signalType: SignalType.COLD, stage: LeadStage.NEW, companyIdx: 32 },
    { firstName: 'Cole', lastName: 'Mercer', email: 'cole.mercer@anduril.com', phone: '+1 (949) 555-0301', linkedinUrl: 'linkedin.com/in/colemercer', title: 'Head of Gov Partnerships', department: 'Business Development', intentScore: 78, signalType: SignalType.WARM, stage: LeadStage.CONTACTED, companyIdx: 33 },
  ];

  const leads = [];
  for (const l of leadsData) {
    const { companyIdx, ...leadFields } = l;
    // Idempotent: skip leads already seeded (matched by email)
    const existing = await prisma.lead.findFirst({
      where: { workspaceId: workspace.id, email: l.email },
    });
    if (existing) {
      leads.push(existing);
      continue;
    }
    const lead = await prisma.lead.create({
      data: {
        ...leadFields,
        workspaceId: workspace.id,
        companyId: companies[companyIdx].id,
        tags: ['outbound', 'q4-target'],
        lastActivityAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        enrichedAt: new Date(),
      },
    });
    leads.push(lead);

    // Intent signals
    const signals = [
      { type: 'job_posting', description: 'Posted 3 sales roles in the last 2 weeks', strength: 85 },
      { type: 'funding', description: 'Series B announced — $120M raised', strength: 90 },
      { type: 'tech_install', description: 'Recently adopted Outreach.io', strength: 70 },
      { type: 'website_visit', description: 'Visited pricing page 4x this week', strength: 95 },
      { type: 'hiring_surge', description: 'Headcount up 40% YoY in sales dept', strength: 80 },
    ];

    const numSignals = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numSignals; i++) {
      const s = signals[i % signals.length];
      await prisma.intentSignal.create({
        data: {
          leadId: lead.id,
          type: s.type,
          description: s.description,
          strength: s.strength - Math.floor(Math.random() * 15),
          detectedAt: new Date(Date.now() - i * 2 * 86400000),
        },
      });
    }

    // Deal for top leads
    if (l.intentScore >= 70) {
      await prisma.deal.create({
        data: {
          title: `${companies[companyIdx].name} — Enterprise Deal`,
          value: 48000 + Math.floor(Math.random() * 100000),
          currency: 'USD',
          stage: l.stage === LeadStage.ENGAGED ? DealStage.NEGOTIATION : DealStage.PROSPECT,
          probability: l.intentScore,
          leadId: lead.id,
        },
      });
    }
  }

  // ── Campaigns ──────────────────────────────────────────────
  const campaignsData = [
    { name: 'Q4 Fintech Outreach', status: CampaignStatus.ACTIVE, totalLeads: 312, totalSent: 1847, totalOpens: 1126, totalReplies: 78, inboundGenerated: 12 },
    { name: 'Enterprise CRO Series', status: CampaignStatus.ACTIVE, totalLeads: 88, totalSent: 440, totalOpens: 255, totalReplies: 17, inboundGenerated: 5 },
    { name: 'SaaS Founder Cold', status: CampaignStatus.PAUSED, totalLeads: 540, totalSent: 2100, totalOpens: 1092, totalReplies: 61, inboundGenerated: 18 },
    { name: 'VC Outreach Q3', status: CampaignStatus.DRAFT, totalLeads: 0, totalSent: 0, totalOpens: 0, totalReplies: 0, inboundGenerated: 0 },
  ];

  for (const c of campaignsData) {
    const campaign = await prisma.campaign.create({
      data: {
        ...c,
        workspaceId: workspace.id,
        fromName: 'Mahima V.',
        trackOpens: true,
        trackClicks: true,
        dailyLimit: 100,
        timezone: 'America/New_York',
      },
    });

    // Steps
    const steps = [
      { order: 1, type: 'EMAIL' as const, name: 'Initial outreach', subject: 'Quick question about {{firstName}}\'s team', body: 'Hi {{firstName}},\n\nI noticed your team has been scaling rapidly — congrats on the growth!\n\nWe help revenue teams like yours land in the inbox every time. Mind if I share how?\n\nBest,\nMahima' },
      { order: 2, type: 'DELAY' as const, name: 'Wait 3 days', delayDays: 3 },
      { order: 3, type: 'EMAIL' as const, name: 'Follow-up', subject: 'Re: Quick question', body: 'Hi {{firstName}},\n\nJust checking in — did you get a chance to see my last email?\n\nWould love 15 minutes to show you how we\'ve helped teams like yours 3x their reply rates.\n\nBest,\nMahima' },
      { order: 4, type: 'CONDITION' as const, name: 'Check if opened', conditionType: 'opened' },
      { order: 5, type: 'EMAIL' as const, name: 'Final touch', subject: 'Closing the loop', body: 'Hi {{firstName}},\n\nI don\'t want to be a nuisance — just wanted to leave this here in case the timing is ever right.\n\nHappy to connect whenever works for you.\n\nMahima' },
    ];

    for (const step of steps) {
      await prisma.campaignStep.create({
        data: { ...step, campaignId: campaign.id },
      });
    }
  }

  // ── Activities ─────────────────────────────────────────────
  const activityItems = [
    { type: ActivityType.EMAIL_REPLIED, title: 'Marcus Webb replied to campaign email', leadIdx: 0 },
    { type: ActivityType.INBOX_WARMED, title: 'alex@acmecorp.io fully warmed', leadIdx: null },
    { type: ActivityType.LEAD_ENRICHED, title: 'Lisa Chen enriched with 5 new signals', leadIdx: 1 },
    { type: ActivityType.EMAIL_OPENED, title: 'Jordan Kim opened follow-up email', leadIdx: 2 },
    { type: ActivityType.CAMPAIGN_STARTED, title: 'Q4 Fintech Outreach campaign launched', leadIdx: null },
    { type: ActivityType.DOMAIN_VERIFIED, title: 'acmecorp.io domain verified', leadIdx: null },
    { type: ActivityType.AI_INSIGHT, title: 'AI detected 3 inboxes at risk', leadIdx: null },
    { type: ActivityType.LEAD_CREATED, title: 'Priya Sharma added to pipeline', leadIdx: 3 },
    { type: ActivityType.EMAIL_SENT, title: 'Batch send completed — 247 emails', leadIdx: null },
    { type: ActivityType.EMAIL_REPLIED, title: 'Lisa Chen replied — hot signal', leadIdx: 1 },
  ];

  for (let i = 0; i < activityItems.length; i++) {
    const item = activityItems[i];
    await prisma.activity.create({
      data: {
        type: item.type,
        title: item.title,
        workspaceId: workspace.id,
        leadId: item.leadIdx !== null ? leads[item.leadIdx].id : null,
        createdAt: new Date(Date.now() - i * 3600000 * 2),
      },
    });
  }

  // ── AI Insights ────────────────────────────────────────────
  await prisma.aiInsight.createMany({
    data: [
      { workspaceId: workspace.id, type: 'deliverability', title: '3 inboxes showing declining placement', body: 'hello@acmecorp.io, bd@acmecorp.io, and sales@acmecorp.io have inbox rates below 80%. Consider reducing send volume and increasing warmup activity.', priority: 'high' },
      { workspaceId: workspace.id, type: 'lead_score', title: 'Marcus Webb is primed to close', body: 'Intent score jumped to 96 after 4 pricing page visits. Recommended action: personalized video outreach within 24 hours.', priority: 'high' },
      { workspaceId: workspace.id, type: 'send_time', title: 'Optimal send window detected', body: 'Your highest reply rates occur Tuesday–Thursday between 9–11 AM EST. Consider scheduling next campaign batch accordingly.', priority: 'medium' },
      { workspaceId: workspace.id, type: 'campaign_suggestion', title: 'Q4 Fintech campaign performing above benchmark', body: '61% open rate vs 45% industry average. The personalized subject line approach is working — apply it to other active campaigns.', priority: 'low' },
    ],
  });

  console.log('✅ Seed complete!');
  console.log(`   Workspace: ${workspace.id}`);
  console.log(`   User:      ${user.id}`);
  console.log(`   Inboxes:   ${inboxes.length}`);
  console.log(`   Leads:     ${leads.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
