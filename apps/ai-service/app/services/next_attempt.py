from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

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


class NextAttemptPredictor:
    def __init__(self, artifact_path: Path) -> None:
        self.artifact_path = artifact_path
        self._artifact: dict[str, object] | None = None
        if artifact_path.exists():
            loaded = joblib.load(artifact_path)
            if isinstance(loaded, dict):
                self._artifact = loaded

    @property
    def mode(self) -> str:
        return "MODEL" if self._artifact is not None else "DETERMINISTIC_FALLBACK"

    def predict(self, values: dict[str, float]) -> float:
        if self._artifact is not None:
            model = self._artifact.get("model")
            scaler = self._artifact.get("scaler")
            row = np.array([[values.get(name, 0.0) for name in FEATURES]], dtype=float)
            if scaler is not None:
                row = scaler.transform(row)  # type: ignore[union-attr]
            if model is not None:
                probability = float(model.predict_proba(row)[0, 1])  # type: ignore[union-attr]
                return round(max(0.02, min(0.98, probability)), 4)

        linear = (
            0.42 * values.get("mastery", 0.5)
            + 0.18 * values.get("recent_accuracy", 0.5)
            + 0.12 * values.get("prerequisite_mastery", 0.5)
            + 0.08 * values.get("consistency", 0.5)
            + 0.08 * values.get("engagement", 0.5)
            - 0.17 * values.get("difficulty", 0.5)
            - 0.12 * values.get("forgetting_risk", 0.5)
            - 0.08 * values.get("hint_usage_rate", 0.0)
            + 0.28
        )
        return round(max(0.05, min(0.95, linear)), 4)
