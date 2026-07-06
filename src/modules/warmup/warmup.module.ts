import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WarmupService, WARMUP_QUEUE } from './warmup.service';
import { WarmupController } from './warmup.controller';
import { WarmupProcessor } from './processors/warmup.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: WARMUP_QUEUE }),
  ],
  providers: [WarmupService, WarmupProcessor],
  controllers: [WarmupController],
  exports: [WarmupService],
})
export class WarmupModule {}
