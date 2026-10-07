import { MODULE_METADATA } from "@nestjs/common/constants";
import { NotificationDomainEventSubscriberService } from "./infrastructure/notification-domain-event-subscriber.service";
import { NotificationsCoreModule } from "./notifications-core.module";
import { NotificationsModule } from "./notifications.module";

describe("notification module wiring", () => {
  it("keeps app-only domain subscribers out of the worker-safe module", () => {
    const coreProviders =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, NotificationsCoreModule) ??
      [];
    const appProviders =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, NotificationsModule) ?? [];
    const { JobsModule } = loadJobsModuleWithTestEnv();
    const jobImports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, JobsModule) ?? [];

    expect(coreProviders).not.toContain(NotificationDomainEventSubscriberService);
    expect(appProviders).toContain(NotificationDomainEventSubscriberService);
    expect(jobImports).toContain(NotificationsCoreModule);
    expect(jobImports).not.toContain(NotificationsModule);
  });
});

function loadJobsModuleWithTestEnv(): { JobsModule: Function } {
  process.env.DATABASE_URL ??= "postgresql://aroha:aroha@localhost:5432/aroha";
  process.env.REDIS_URL ??= "redis://localhost:6379/0";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-value-000000000000";
  process.env.PASSWORD_PEPPER ??= "test-password-pepper-value-000000000";
  process.env.REFRESH_TOKEN_PEPPER ??= "test-refresh-pepper-value-000000000";
  process.env.OBJECT_STORAGE_ENDPOINT ??= "http://localhost:9000";
  process.env.OBJECT_STORAGE_REGION ??= "us-east-1";
  process.env.OBJECT_STORAGE_ACCESS_KEY ??= "access-key";
  process.env.OBJECT_STORAGE_SECRET_KEY ??= "secret-key";
  process.env.OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS ??= "profile-photos";
  process.env.OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS ??=
    "message-attachments";

  return require("../../jobs/jobs.module") as { JobsModule: Function };
}
