import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface DomainConcept {
  code: string;
  title: string;
  description: string;
  icon: string;
  order: number;
}

export interface DomainMisconception {
  code: string;
  conceptCode: string;
  title: string;
  description: string;
  severity: string;
}

export interface RegisteredDomain {
  code: string;
  name: string;
  locale: string;
  version: string;
  supportedMedia: string[];
  concepts: DomainConcept[];
  misconceptions: DomainMisconception[];
  prerequisites: Array<{ from: string; to: string; weight: number }>;
  diagnosisRules: Array<Record<string, unknown>>;
  animationTemplates: Array<Record<string, unknown>>;
}

@Injectable()
export class DomainRegistryService {
  private readonly registry = new Map<string, RegisteredDomain>();
  private readonly domainsRoot = [
    path.join(process.cwd(), "domains"),
    path.resolve(process.cwd(), "..", "..", "domains"),
    path.resolve(__dirname, "..", "..", "..", "..", "domains")
  ].find((candidate) => existsSync(candidate)) ?? path.join(process.cwd(), "domains");

  constructor() {
    this.load("python-foundations");
  }

  private json<T>(domainCode: string, file: string): T {
    const filename = path.join(this.domainsRoot, domainCode, file);
    return JSON.parse(readFileSync(filename, "utf8")) as T;
  }

  private load(code: string): void {
    const metadata = this.json<Omit<RegisteredDomain, "concepts" | "misconceptions" | "prerequisites" | "diagnosisRules" | "animationTemplates">>(code, "domain.json");
    this.registry.set(code, {
      ...metadata,
      concepts: this.json<DomainConcept[]>(code, "concepts.json"),
      misconceptions: this.json<DomainMisconception[]>(code, "misconceptions.json"),
      prerequisites: this.json<Array<{ from: string; to: string; weight: number }>>(code, "prerequisites.json"),
      diagnosisRules: this.json<Array<Record<string, unknown>>>(code, "diagnosis-rules.json"),
      animationTemplates: this.json<Array<Record<string, unknown>>>(code, "animation-templates.json")
    });
  }

  list(): RegisteredDomain[] {
    return [...this.registry.values()];
  }

  get(code: string): RegisteredDomain {
    const domain = this.registry.get(code);
    if (!domain) throw new NotFoundException(`Domain ${code} is not registered`);
    return domain;
  }

  hasConcept(domainCode: string, conceptCode: string): boolean {
    return this.get(domainCode).concepts.some((concept) => concept.code === conceptCode);
  }

  hasMisconception(domainCode: string, misconceptionCode: string): boolean {
    return this.get(domainCode).misconceptions.some((item) => item.code === misconceptionCode);
  }
}
