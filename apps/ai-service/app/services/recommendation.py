from __future__ import annotations

from app.schemas.personalization import DiagnosisResult, RecommendationResult, RecommendationTarget


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
        concept_code: str = "PYTHON_RANGE",
        student_goal: str = "Nắm chắc kiến thức nền tảng",
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

        concept_titles = {
            "PYTHON_RANGE": "Điểm dừng của range()",
            "PYTHON_WHILE": "Điều kiện dừng của while",
            "PYTHON_IF_ELSE": "Rẽ nhánh if / elif / else",
            "PYTHON_LISTS": "List và vị trí phần tử",
            "PYTHON_FUNCTIONS": "Hàm, tham số và return",
        }
        concept_title = concept_titles.get(concept_code, concept_code.replace("_", " ").title())
        target_by_action: dict[str, RecommendationTarget] = {
            "PREREQUISITE_REVIEW": RecommendationTarget(
                type="LESSON_PHASE",
                id=f"{concept_code.lower()}-prerequisite-review",
                title=f"Ôn nền tảng trước {concept_title}",
                phase="THEORY",
                estimated_minutes=min(10, available_minutes),
                difficulty=0.3,
            ),
            "MICRO_LESSON": RecommendationTarget(
                type="MICRO_LESSON",
                id=f"{concept_code.lower()}-{diagnosis.misconception_code or 'support'}-v1",
                title=f"Bài bổ trợ: {concept_title}",
                phase="THEORY",
                estimated_minutes=min(7, available_minutes),
                difficulty=0.35,
            ),
            "FLASH_REVIEW": RecommendationTarget(
                type="ACTIVITY",
                id=f"{concept_code.lower()}-flash-review",
                title=f"Ôn nhanh: {concept_title}",
                phase="PRACTICE",
                estimated_minutes=min(5, available_minutes),
                difficulty=0.4,
            ),
            "PRACTICE_SET": RecommendationTarget(
                type="ACTIVITY",
                id=f"{concept_code.lower()}-guided-practice",
                title=f"Bộ luyện có gợi ý: {concept_title}",
                phase="PRACTICE",
                estimated_minutes=min(12, available_minutes),
                difficulty=0.5,
            ),
            "GAME_PRACTICE": RecommendationTarget(
                type="ACTIVITY",
                id=f"{concept_code.lower()}-short-challenge",
                title=f"Thử thách ngắn: {concept_title}",
                phase="PRACTICE",
                estimated_minutes=min(6, available_minutes),
                difficulty=0.5,
            ),
            "CONTINUE_PATH": RecommendationTarget(
                type="LESSON_PHASE",
                id=f"{concept_code.lower()}-next-lesson",
                title="Tiếp tục bài kế tiếp trong lộ trình",
                phase="THEORY",
                estimated_minutes=min(20, available_minutes),
                difficulty=0.6,
            ),
            "CHECKPOINT": RecommendationTarget(
                type="ACTIVITY",
                id=f"{concept_code.lower()}-checkpoint",
                title=f"Kiểm tra cuối bài: {concept_title}",
                phase="CHECKPOINT",
                estimated_minutes=min(10, available_minutes),
                difficulty=0.65,
            ),
            "TEACHER_SUPPORT": RecommendationTarget(
                type="ACTIVITY",
                id=f"{concept_code.lower()}-teacher-support",
                title=f"Trao đổi với giáo viên: {concept_title}",
                phase="THEORY",
                estimated_minutes=min(15, available_minutes),
                difficulty=0.4,
            ),
        }

        reasons = [f"Mastery của concept hiện ở mức {mastery:.0%}."]
        if forgetting_risk >= 0.35:
            reasons.append(f"Nguy cơ quên ước tính {forgetting_risk:.0%}.")
        if recent_error_rate >= 0.4:
            reasons.append(f"Tỉ lệ sai gần đây là {recent_error_rate:.0%}.")
        if repeated_misconception_count >= 2:
            reasons.append(f"Học viên lặp lại cùng misconception {repeated_misconception_count} lần gần đây.")
        if diagnosis.status == "MATCHED" and diagnosis.misconception_code:
            reasons.append(f"Rule đã xác nhận {diagnosis.misconception_code} với evidence cụ thể.")
        if prerequisite_mastery < 0.55:
            reasons.append(f"Mastery prerequisite mới đạt {prerequisite_mastery:.0%}.")
        if student_goal:
            reasons.append(f"Hoạt động này giữ lộ trình hướng tới mục tiêu: {student_goal}.")

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
                "candidateScores": {
                    "knowledgeGap": round(knowledge_gap, 4),
                    "forgettingRisk": round(forgetting_risk, 4),
                    "recentErrorRate": round(recent_error_rate, 4),
                    "prerequisiteGap": round(prerequisite_importance, 4),
                    "courseRelevance": round(course_relevance, 4),
                },
                "selectedBecause": action,
            },
            target=target_by_action[action],
        )
