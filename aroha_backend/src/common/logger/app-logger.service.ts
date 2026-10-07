import { ConsoleLogger, Injectable, LogLevel } from "@nestjs/common";

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor() {
    super("Aroha", {
      logLevels: ["log", "error", "warn", "debug", "verbose"] as LogLevel[],
    });
  }
}
