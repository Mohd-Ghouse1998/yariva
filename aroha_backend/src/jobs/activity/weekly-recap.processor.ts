import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { BullmqProducer } from "../../integrations/bullmq/bullmq.producer";
import { ActivityService } from "../../modules/activity/application/activity.service";
@Injectable()
export class WeeklyRecapProcessor implements OnApplicationBootstrap {
  constructor(
    private readonly queue: BullmqProducer,
    private readonly activity: ActivityService,
  ) {}
  async onApplicationBootstrap() {
    await this.queue.scheduleRecurring("activity.weekly-recap", 3_600_000);
  }
  async process() {
    await this.activity.reconcile();
  }
}
