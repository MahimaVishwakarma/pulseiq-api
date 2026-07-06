import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsService, CAMPAIGN_QUEUE } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignProcessor } from './processors/campaign.processor';

@Module({
  imports: [BullModule.registerQueue({ name: CAMPAIGN_QUEUE })],
  providers: [CampaignsService, CampaignProcessor],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
