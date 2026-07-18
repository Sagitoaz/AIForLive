import { Global, Module } from "@nestjs/common";
import { DomainRegistryController } from "./domain-registry.controller";
import { DomainRegistryService } from "./domain-registry.service";

@Global()
@Module({
  controllers: [DomainRegistryController],
  providers: [DomainRegistryService],
  exports: [DomainRegistryService]
})
export class DomainRegistryModule {}
