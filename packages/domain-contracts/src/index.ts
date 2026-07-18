export interface ConceptDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  order: number;
}

export interface MisconceptionDefinition {
  code: string;
  conceptCode: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface DiagnosisRuleDefinition {
  id: string;
  misconceptionCode: string;
  strategy: string;
  confidence: number;
  evidenceTemplates: string[];
}

export interface DomainDefinition {
  code: string;
  name: string;
  locale: string;
  version: string;
  supportedMedia: string[];
  concepts: ConceptDefinition[];
  misconceptions: MisconceptionDefinition[];
  diagnosisRules: DiagnosisRuleDefinition[];
}
