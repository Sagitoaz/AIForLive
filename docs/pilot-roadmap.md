# Pilot roadmap

## Scope

One six-week Python foundations course (4 modules, 12 lessons, about 16 hours), one class, one teacher and 20 consented learners. Every lesson follows Theory → Practice → Checkpoint. AI content always requires human review. The model cannot be used for grades or discipline.

## Weeks

1. Baseline diagnostic, accessibility/device check and teacher calibration.
2. Personalization events, explicit fallback monitoring and weekly teacher review.
3. Full-lesson drafting plus targeted remediation/reuse, qualitative feedback and misconception audits.
4. Checkpoint comparison, retention review and safety review.
5–6. Optional extension for sparse data, intervention refinement and closing interviews.

## Content-production baseline and measurement

The brief's planning baseline is **40–50 teacher-hours for one complete lesson** using the current manual workflow. This is a hypothesis to validate in week 0, not a measured product result. The teacher records a time diary for representative lesson, quiz, narration and review tasks; the report keeps the observed range and does not replace missing observations with the planning estimate.

For the assisted workflow, an active teacher timer starts when the generated draft is first opened, pauses during explicit breaks or sustained inactivity, resumes for revisions and stops at approve/reject. Generation latency is recorded separately in milliseconds. Each content record should retain content ID, provider/model, prompt version, source IDs, draft timestamp, active editing seconds, review seconds, edit count, decision, reuse count and publish timestamp.

The before/after comparison uses two matched complete lessons of the same scope, grade band, three-phase structure and review rubric. Seven-minute remediation is measured separately and must not be compared directly with the brief's complete-lesson baseline:

- manual active minutes per approved micro-lesson and total manual course hours;
- assisted generation latency, active teacher-edit minutes and review minutes per approved micro-lesson;
- median, range and percentage change from the validated manual baseline;
- factual corrections, rejected drafts and teacher override rate as quality guardrails;
- time avoided through reuse, reported separately from first-time creation.

An efficiency gain is not counted when content fails educational validation or needs a critical factual correction. With one pilot teacher, results are descriptive and must not be presented as a causal population estimate.

## Success metrics

- completion and return rate;
- change in mastery and delayed recall, with uncertainty;
- recommendation acceptance and override rate;
- validated manual baseline versus active teacher editing/review time, plus content reuse;
- fallback/error rate;
- student/teacher perceived usefulness and confusion;
- accessibility and privacy incidents (target zero).

## Privacy

Collect the minimum event fields, define retention, separate identity from analytics, obtain appropriate consent/assent, prohibit external provider training on pilot data and provide deletion/export procedures.

## Retraining gate

Do not retrain automatically. First validate labels, audit cohort coverage and fairness, use student/time-aware splits, calibrate, compare against a simple baseline, document model/version changes and retain rollback capability.
