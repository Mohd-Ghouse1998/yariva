import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import rtcConfig from "../../config/rtc.config";

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class TurnCredentialService {
  constructor(
    @Inject(rtcConfig.KEY)
    private readonly config: ConfigType<typeof rtcConfig>,
  ) {}

  getIceServers(): IceServerConfig[] {
    const iceServers: IceServerConfig[] = [];

    if (this.config.stunUrls.length > 0) {
      iceServers.push({
        urls: this.config.stunUrls,
      });
    }

    if (
      this.config.turnUrls.length > 0 &&
      this.config.turnUsername &&
      this.config.turnCredential
    ) {
      iceServers.push({
        urls: this.config.turnUrls,
        username: this.config.turnUsername,
        credential: this.config.turnCredential,
      });
    }

    return iceServers;
  }

  areVoiceIntroductionsEnabled(): boolean { return this.config.voiceIntroductionsEnabled; }

  getIntroductionSuggestedSeconds(): number { return this.config.introductionSuggestedSeconds; }

  getRingTimeoutMs(): number {
    return this.config.ringTimeoutSeconds * 1_000;
  }

  getConnectTimeoutMs(): number {
    return this.config.connectTimeoutSeconds * 1_000;
  }

  getSignalTtlSeconds(): number {
    return this.config.signalTtlSeconds;
  }
}
