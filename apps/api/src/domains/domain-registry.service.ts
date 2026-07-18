import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DomainRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.learningDomain.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: {
        concepts: { where: { status: "ACTIVE", deletedAt: null }, orderBy: { order: "asc" } },
        misconceptions: { where: { status: "ACTIVE", deletedAt: null } },
        diagnosisRules: { where: { status: "ACTIVE", deletedAt: null } }
      },
      orderBy: { createdAt: "asc" }
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      locale: row.locale,
      version: row.version,
      definition: row.definitionJson,
      concepts: row.concepts,
      misconceptions: row.misconceptions,
      diagnosisRules: row.diagnosisRules
    }));
  }

  async get(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.learningDomain.findFirst({
      where: { code, status: "ACTIVE", deletedAt: null },
      include: {
        concepts: {
          where: { status: "ACTIVE", deletedAt: null },
          include: { dependsOn: { include: { prerequisite: true } } },
          orderBy: { order: "asc" }
        },
        misconceptions: { where: { status: "ACTIVE", deletedAt: null } },
        diagnosisRules: { where: { status: "ACTIVE", deletedAt: null } }
      }
    });
    if (!row) throw new NotFoundException(`Domain ${code} is not registered in Supabase`);
    return {
      code: row.code,
      name: row.name,
      locale: row.locale,
      version: row.version,
      definition: row.definitionJson,
      concepts: row.concepts,
      misconceptions: row.misconceptions,
      diagnosisRules: row.diagnosisRules
    };
  }

  async hasConcept(domainCode: string, conceptCode: string): Promise<boolean> {
    return Boolean(await this.prisma.learningConcept.findFirst({ where: { code: conceptCode, domain: { code: domainCode } } }));
  }

  async hasMisconception(domainCode: string, misconceptionCode: string): Promise<boolean> {
    return Boolean(await this.prisma.misconception.findFirst({ where: { code: misconceptionCode, domain: { code: domainCode } } }));
  }
}
