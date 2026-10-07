import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ObjectStorageService } from "./object-storage.service";
import { MediaDisclosureService } from "./media-disclosure.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MediaDisclosureService, ObjectStorageService],
  exports: [MediaDisclosureService, ObjectStorageService],
})
export class ObjectStorageModule {}
