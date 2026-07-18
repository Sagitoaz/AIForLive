# Domain plugin architecture

Core services use `LearningDomain`, `LearningConcept`, `Misconception`, `Exercise` and `Recommendation`; they do not use classes such as `PythonSkillState`. Subject-specific knowledge lives under `domains/<domain-code>`.

## Package contract

A domain package declares:

- `domain.json`: metadata, locale, media and exercise types;
- `concepts.json`: stable concept codes and display metadata;
- `prerequisites.json`: directed weighted edges;
- `misconceptions.json`: registered labels, never free-form model inventions;
- `diagnosis-rules.json`: deterministic strategies and evidence templates;
- `activities.json`: supported learning activities;
- `animation-templates.json`: safe renderer names and allowed data keys;
- `content-prompts/`: subject-specific structured generation guidance.

NestJS `DomainRegistryService` loads packages and validates generation requests. Python `DomainRuleEngine` receives `domain_code`, loads the matching strategies and can return `UNKNOWN` or `NEED_MORE_EVIDENCE`.

## Add a domain

1. Copy an example package and choose a stable lowercase domain code.
2. Add concept definitions with globally stable uppercase codes.
3. Add prerequisite edges and test for cycles in production tooling.
4. Register misconceptions only when an educator can define evidence.
5. Implement a bounded diagnosis strategy; do not add subject branches to core BKT.
6. Map concepts to existing animation templates or add a safe renderer plus schema.
7. Seed a course that points to the new `LearningDomain`.
8. Add rule, registry, UI and content-validation tests.

English and mathematics examples demonstrate that core schemas need no changes for another subject.
