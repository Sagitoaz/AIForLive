# EduRecall AI repository instructions

Follow the canonical project rules in `AGENTS.md`. Before suggesting or applying a change, trace the real web → API → AI/database path and preserve these invariants:

- server owns identity and answer scoring;
- recommendations use persisted per-student evidence and resolve to real targets;
- AI output stays unavailable to students until teacher review and `PUBLISHED` status;
- deterministic template, external LLM, fallback and synthetic-data results are labeled accurately;
- README and metrics contain only claims backed by current code, passing tests, a live demo or a declared measurement protocol.

