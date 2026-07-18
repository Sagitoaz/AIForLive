from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class ForgettingResult:
    retrievability: float
    forgetting_risk: float
    recommended_interval_days: int
    stability_after: float
    explanation: str


class ExponentialForgettingModel:
    """Replaceable interface compatible with a future FSRS adapter."""

    def calculate(
        self,
        *,
        elapsed_days: float,
        stability: float,
        previous_recall_quality: float,
        consecutive_successes: int,
        recent_failures: int,
    ) -> ForgettingResult:
        safe_stability = max(0.25, stability)
        success_factor = 1.0 + min(consecutive_successes, 8) * 0.12
        failure_factor = max(0.35, 1.0 - min(recent_failures, 5) * 0.13)
        quality_factor = 0.75 + max(0.0, min(1.0, previous_recall_quality)) * 0.5
        adjusted_stability = safe_stability * success_factor * failure_factor * quality_factor
        retrievability = math.exp(-max(elapsed_days, 0.0) / adjusted_stability)
        retrievability = max(0.0, min(1.0, retrievability))
        target_recall = 0.82
        recommended = max(1, min(90, round(-adjusted_stability * math.log(target_recall))))
        return ForgettingResult(
            retrievability=round(retrievability, 4),
            forgetting_risk=round(1.0 - retrievability, 4),
            recommended_interval_days=recommended,
            stability_after=round(adjusted_stability, 4),
            explanation=(
                f"Sau {elapsed_days:.1f} ngày, độ ổn định điều chỉnh là "
                f"{adjusted_stability:.2f}; khả năng nhớ lại ước tính {retrievability:.0%}."
            ),
        )
