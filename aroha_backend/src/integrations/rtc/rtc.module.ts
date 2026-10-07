import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TurnCredentialService } from "./turn-credential.service";

@Module({
  imports: [ConfigModule],
  providers: [TurnCredentialService],
  exports: [TurnCredentialService],
})
export class RtcModule {}
