from __future__ import annotations

from app.schemas.personalization import DiagnosisResult, RecommendationResult


class RecommendationEngine:
    def recommend(
        self,
        *,
        mastery: float,
        forgetting_risk: float,
        recent_error_rate: float,
        prerequisite_mastery: float,
        course_progress: float,
        repeated_misconception_count: int,
        next_attempt_probability: float,
        available_minutes: int,
        diagnosis: DiagnosisResult,
        event_id: str,
        model_version: str,
    ) -> RecommendationResult:
        knowledge_gap = 1.0 - mastery
        prerequisite_importance = 1.0 - prerequisite_mastery
        course_relevance = max(0.35, 1.0 - course_progress * 0.35)
        priority = (
            0.35 * knowledge_gap
            + 0.25 * forgetting_risk
            + 0.20 * recent_error_rate
            + 0.10 * prerequisite_importance
            + 0.10 * course_relevance
        )
        if repeated_misconception_count >= 2:
            priority = min(1.0, priority + 0.1)

        if prerequisite_mastery < 0.45:
            action = "PREREQUISITE_REVIEW"
        elif repeated_misconception_count >= 2 or diagnosis.status == "MATCHED":
            action = "MICRO_LESSON"
        elif forgetting_risk >= 0.65:
            action = "FLASH_REVIEW"
        elif mastery < 0.5 or next_attempt_probability < 0.45:
            action = "PRACTICE_SET"
        elif available_minutes <= 6:
            action = "GAME_PRACTICE"
        elif mastery >= 0.85 and forgetting_risk < 0.25:
            action = "CONTINUE_PATH"
        else:
            action = "CHECKPOINT"

        reasons = [f"Mastery của concept hiện ở mức {mastery:.0%}."]
        if forgetting_risk >= 0.35:
            reasons.append(f"Nguy cơ quên ước tính {forgetting_risk:.0%}.")
        if recent_error_rate >= 0.4:
            reasons.append(f"Tỉ lệ sai gần đây là {recent_error_rate:.0%}.")
        if repeated_misconception_count >= 2:
            reasons.append(
                f"Học viên lặp lại cùng misconception {repeated_misconception_count} lần gần đây."
            )
        if diagnosis.status == "MATCHED" and diagnosis.misconception_code:
            reasons.append(f"Rule đã xác nhận {diagnosis.misconception_code} với evidence cụ thể.")
        if prerequisite_mastery < 0.55:
            reasons.append(f"Mastery prerequisite mới đạt {prerequisite_mastery:.0%}.")

        return RecommendationResult(
            action=action,
            priority_score=round(max(0.0, min(1.0, priority)), 4),
            reasons=reasons,
            evidence={
                "attemptIds": [event_id],
                "modelVersion": model_version,
                "ruleId": diagnosis.rule_id,
                "mastery": round(mastery, 4),
                "forgettingRisk": round(forgetting_risk, 4),
                "nextAttemptProbability": round(next_attempt_probability, 4),
            },
        )
