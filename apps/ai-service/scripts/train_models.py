from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "synthetic" / "attempts.csv"
ARTIFACT_DIR = ROOT / "ml" / "artifacts"
FEATURES = [
    "mastery",
    "recent_accuracy",
    "difficulty",
    "hint_usage_rate",
    "average_response_time",
    "attempt_count",
    "days_since_last_practice",
    "forgetting_risk",
    "misconception_repetition_count",
    "prerequisite_mastery",
    "consistency",
    "engagement",
]


def engineer(raw: pd.DataFrame) -> pd.DataFrame:
    frame = raw.sort_values(["student_id", "occurred_at"]).copy()
    grouped = frame.groupby(["student_id", "concept_code"], sort=False)
    prior_correct = grouped["is_correct"].transform(lambda series: series.shift().rolling(5, 1).mean())
    prior_hints = grouped["used_hint"].transform(lambda series: series.shift().rolling(5, 1).mean())
    prior_response = grouped["response_time_ms"].transform(
        lambda series: series.shift().rolling(5, 1).mean()
    )
    prior_count = grouped.cumcount()
    prior_misconceptions = grouped["misconception_code"].transform(
        lambda series: series.shift().fillna("").ne("").rolling(5, 1).sum()
    )
    frame["recent_accuracy"] = prior_correct.fillna(0.5)
    frame["hint_usage_rate"] = prior_hints.fillna(0.0)
    frame["average_response_time"] = prior_response.fillna(15_000) / 1000.0
    frame["attempt_count"] = prior_count
    frame["misconception_repetition_count"] = prior_misconceptions.fillna(0.0)
    frame["mastery"] = (0.25 + frame["latent_ability"] * 0.65 + frame["recent_accuracy"] * 0.1).clip(0, 1)
    frame["forgetting_risk"] = (
        1 - np.exp(-frame["days_since_last_practice"] / (2.0 + frame["mastery"] * 5.0))
    ).clip(0, 1)
    persona_consistency = frame["student_id"].map(
        {f"student-{index:02d}": 0.35 if index in {7, 17} else 0.78 for index in range(1, 21)}
    )
    frame["consistency"] = persona_consistency.fillna(0.7)
    frame["engagement"] = (1.0 - frame["skipped"] * 0.4 - frame["used_hint"] * 0.08).clip(0, 1)
    frame["target"] = grouped["is_correct"].shift(-1)
    return frame.dropna(subset=["target"])


def main() -> None:
    if not DATA.exists():
        raise SystemExit("Synthetic data missing. Run npm run ai:data first.")
    frame = engineer(pd.read_csv(DATA).fillna(""))
    x_data = frame[FEATURES].astype(float).to_numpy()
    y_data = frame["target"].astype(int).to_numpy()
    groups = frame["student_id"].to_numpy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=20260718)
    train_idx, test_idx = next(splitter.split(x_data, y_data, groups))
    scaler = StandardScaler()
    x_train = scaler.fit_transform(x_data[train_idx])
    x_test = scaler.transform(x_data[test_idx])
    model = LogisticRegression(max_iter=1_000, class_weight="balanced", random_state=20260718)
    model.fit(x_train, y_data[train_idx])
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    fraction_positive, mean_predicted = calibration_curve(
        y_data[test_idx], probabilities, n_bins=5, strategy="quantile"
    )
    metrics = {
        "data_notice": "SYNTHETIC DATA — NOT REAL EDUONE DATA",
        "split": "GroupShuffleSplit by student; no student appears in both sets",
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_students": sorted(set(groups[train_idx].tolist())),
        "test_students": sorted(set(groups[test_idx].tolist())),
        "accuracy": round(float(accuracy_score(y_data[test_idx], predictions)), 4),
        "precision": round(float(precision_score(y_data[test_idx], predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_data[test_idx], predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(y_data[test_idx], predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_data[test_idx], probabilities)), 4),
        "brier_score": round(float(brier_score_loss(y_data[test_idx], probabilities)), 4),
        "confusion_matrix": confusion_matrix(y_data[test_idx], predictions).tolist(),
        "calibration": [
            {"mean_predicted": round(float(predicted), 4), "fraction_positive": round(float(actual), 4)}
            for predicted, actual in zip(mean_predicted, fraction_positive, strict=True)
        ],
        "feature_importance": {
            name: round(float(weight), 5)
            for name, weight in zip(FEATURES, model.coef_[0], strict=True)
        },
    }
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "scaler": scaler,
            "features": FEATURES,
            "model_version": "next-attempt-logreg-v1",
            "scikit_learn_version": sklearn.__version__,
            "data_notice": metrics["data_notice"],
        },
        ARTIFACT_DIR / "next_attempt_model.joblib",
    )
    (ARTIFACT_DIR / "evaluation.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
