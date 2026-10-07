import { Controller, Get } from "@nestjs/common";
import { TurnCredentialService } from "../../../integrations/rtc/turn-credential.service";

@Controller("calls")
export class CallCapabilitiesController {
  constructor(private readonly rtc: TurnCredentialService) {}
  @Get("capabilities")
  get() { return { voiceIntroductionsEnabled: this.rtc.areVoiceIntroductionsEnabled() }; }
}
