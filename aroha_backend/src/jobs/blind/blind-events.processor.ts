import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { BullmqProducer } from "../../integrations/bullmq/bullmq.producer";
import { BlindService } from "../../modules/blind/application/blind.service";
@Injectable()
export class BlindEventsProcessor implements OnApplicationBootstrap {
  constructor(private readonly queue: BullmqProducer, private readonly blind: BlindService) {}
  async onApplicationBootstrap() { await this.queue.scheduleRecurring("blind.events.reconcile", 60_000); }
  async process() { await this.blind.reconcile(); }
}
