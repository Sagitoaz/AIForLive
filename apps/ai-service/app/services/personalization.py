from __future__ import annotations

from datetime import UTC, datetime

from app.core.settings import settings
from app.schemas.personalization import AnalyzeEventRequest, AnalyzeEventResponse
from app.services.diagnosis import DomainRuleEngine
from app.services.forgetting import ExponentialForgettingModel
from app.services.knowledge_tracing import BayesianKnowledgeTracer
from app.services.next_attempt import NextAttemptPredictor
from app.services.recommendation import RecommendationEngine


class PersonalizationService:
    def __init__(self) -> None:
        self.tracer = BayesianKnowledgeTracer()
        self.forgetting = ExponentialForgettingModel()
        self.diagnosis = DomainRuleEngine(settings.domains_dir)
        self.predictor = NextAttemptPredictor(settings.artifact_path)
        self.recommendations = RecommendationEngine()
        self._processed: dict[str, AnalyzeEventResponse] = {}

    def analyze(self, request: AnalyzeEventRequest) -> AnalyzeEventResponse:
        existing = self._processed.get(request.event_id)
        if existing is not None:
            return existing

        update = self.tracer.update(request.current_state.mastery, request.attempt)
        now = datetime.now(UTC)
        if request.current_state.last_practiced_at:
            elapsed_days = max(
                0.0, (now - request.current_state.last_practiced_at).total_seconds() / 86_400
            )
        elif request.recent_history:
            elapsed_days = max(
                0.0, (now - request.recent_history[-1].occurred_at).total_seconds() / 86_400
            )
        else:
            elapsed_days = 3.0

        recall = self.forgetting.calculate(
            elapsed_days=elapsed_days,
            stability=request.current_state.stability,
            previous_recall_quality=update.mastery_after,
            consecutive_successes=request.current_state.consecutive_successful_reviews,
            recent_failures=request.current_state.recent_failures + (0 if request.attempt.is_correct else 1),
        )
        diagnosis = self.diagnosis.diagnose(
            request.domain_code, request.concept_code, request.attempt
        )
        recent = request.recent_history[-10:]
        recent_accuracy = (
            sum(1 for item in recent if item.is_correct) / len(recent) if recent else 0.5
        )
        recent_error_rate = 1.0 - recent_accuracy
        hint_rate = sum(1 for item in recent if item.used_hint) / len(recent) if recent else 0.0
        repeated = (
            sum(
                1
                for item in recent
                if item.misconception_code == diagnosis.misconception_code
                and diagnosis.misconception_code is not None
            )
            + (1 if diagnosis.status == "MATCHED" else 0)
        )
        next_probability = self.predictor.predict(
            {
                "mastery": update.mastery_after,
                "recent_accuracy": recent_accuracy,
                "difficulty": request.attempt.difficulty,
                "hint_usage_rate": hint_rate,
                "average_response_time": request.attempt.response_time_ms / 1000.0,
                "attempt_count": float(len(recent) + 1),
                "days_since_last_practice": elapsed_days,
                "forgetting_risk": recall.forgetting_risk,
                "misconception_repetition_count": float(repeated),
                "prerequisite_mastery": request.prerequisite_mastery,
                "consistency": 0.7,
                "engagement": 0.75,
            }
        )
        recommendation = self.recommendations.recommend(
            mastery=update.mastery_after,
            forgetting_risk=recall.forgetting_risk,
            recent_error_rate=recent_error_rate,
            prerequisite_mastery=request.prerequisite_mastery,
            course_progress=request.course_progress,
            repeated_misconception_count=repeated,
            next_attempt_probability=next_probability,
            available_minutes=request.available_minutes,
            concept_code=request.concept_code,
            student_goal=request.student_goal,
            diagnosis=diagnosis,
            event_id=request.event_id,
            model_version=settings.model_version,
        )
        response = AnalyzeEventResponse(
            event_id=request.event_id,
            model_version=settings.model_version,
            mastery_before=update.mastery_before,
            mastery_after=update.mastery_after,
            observation_confidence=update.observation_confidence,
            retrievability=recall.retrievability,
            forgetting_risk=recall.forgetting_risk,
            recommended_interval_days=recall.recommended_interval_days,
            next_attempt_probability=next_probability,
            diagnosis=diagnosis,
            recommendation=recommendation,
            explanations=[
                "Knowledge tracing ước lượng mức hiểu từ chuỗi quan sát.",
                recall.explanation,
                "Scheduler chọn thời điểm ôn; recommendation chọn hoạt động tiếp theo.",
                f"Next-attempt predictor đang ở chế độ {self.predictor.mode}.",
            ],
        )
        self._processed[request.event_id] = response
        return response
