# Model card — next-attempt-logreg-v1

## Summary

The artifact predicts `P(next answer is correct)` for a prototype learner-concept interaction. It is a logistic regression with standardized features and is not an educational assessment.

## Intended use

- demonstrate a replaceable prediction artifact;
- contribute a bounded signal to activity recommendation;
- test model loading, fallback and monitoring architecture.

## Prohibited use

Do not use this model to grade, rank, discipline, admit, exclude or make high-stakes decisions about a learner. Do not present its output as a diagnosis or a causal measure of ability.

## Data

**SYNTHETIC DATA — NOT REAL EDUONE DATA.** The fixed-seed generator creates 20 personas, 8 concepts, 48 exercises and 400 attempts. It deliberately includes skipped work, hints, anomalies, sparse histories, lucky guesses and repeated misconceptions.

## Features

Mastery, recent accuracy, difficulty, hint rate, mean response time, prior attempt count, days since practice, forgetting risk, repeated misconception count, prerequisite mastery, consistency and engagement.

## Split and leakage control

`GroupShuffleSplit` separates students, so the same student cannot appear in both train and test. Row-random splitting is prohibited because adjacent attempts leak history.

## Reproducible prototype metrics

The checked-in evaluation contains Accuracy `0.6703`, Precision `0.7568`, Recall `0.8235`, F1 `0.7887`, ROC-AUC `0.5691` and Brier score `0.2169`. These modest synthetic metrics are reported rather than hidden; they do not support a claim of generalization.

## Limitations and risk

- Synthetic behavior may not match real learners.
- Calibration is weak and cohort-specific.
- Response time can reflect device, accessibility or context rather than knowledge.
- Persona fields can encode assumptions and must not become protected-attribute proxies.
- Sparse histories have greater uncertainty than the point estimate displays.

## Required next steps

Run a consented pilot, audit data quality, stratify metrics, calibrate probabilities, collect teacher feedback, document fairness findings, define rollback thresholds and retrain only after governance review.
