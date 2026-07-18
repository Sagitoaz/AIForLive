# Recommendation explainability

Every recommendation stores its action, priority, model version, rule ID, attempt IDs, signal snapshot and human-readable reasons.

For the demo range event:

- knowledge gap comes from BKT mastery;
- forgetting risk comes from the recall model;
- recent error rate comes from bounded history;
- prerequisite importance comes from the domain graph;
- course relevance comes from path position and goal;
- `RANGE_STOP_INCLUDED` comes from `range-stop-rule-v1` evidence.

The teacher view shows formula weights separately from evidence. A reason is emitted only when its signal crosses the matching threshold. The system never asks a generative model to explain a numeric result after the fact.

One weak observation returns `NEED_MORE_EVIDENCE`; an unmatched wrong answer returns `UNKNOWN`. This avoids turning every mistake into a stable learner label.
