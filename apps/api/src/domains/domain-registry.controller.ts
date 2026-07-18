import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DomainRegistryService } from "./domain-registry.service";

@ApiTags("domains")
@Controller("domains")
export class DomainRegistryController {
  constructor(private readonly domains: DomainRegistryService) {}

  @Get()
  list(): ReturnType<DomainRegistryService["list"]> {
    return this.domains.list();
  }

  @Get(":code")
  get(@Param("code") code: string): ReturnType<DomainRegistryService["get"]> {
    return this.domains.get(code);
  }
}
