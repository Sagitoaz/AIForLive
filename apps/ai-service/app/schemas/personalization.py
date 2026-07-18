from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CurrentState(StrictModel):
    mastery: float = Field(ge=0.0, le=1.0)
    stability: float = Field(gt=0.0, le=365.0)
    retrievability: float = Field(ge=0.0, le=1.0)
    consecutive_successful_reviews: int = Field(default=0, ge=0, le=100)
    recent_failures: int = Field(default=0, ge=0, le=100)
    last_practiced_at: datetime | None = None


class AttemptObservation(StrictModel):
    is_correct: bool
    used_hint: bool
    attempt_number: int = Field(ge=1, le=100)
    difficulty: float = Field(ge=0.0, le=1.0)
    response_time_ms: int = Field(ge=0, le=3_600_000)
    skipped: bool = False
    submitted_answer: str | None = Field(default=None, max_length=2_000)
    expected_answer: str | None = Field(default=None, max_length=2_000)
    stop_value: int | None = None


class HistoryEvent(StrictModel):
    is_correct: bool
    used_hint: bool = False
    occurred_at: datetime
    misconception_code: str | None = None


class AnalyzeEventRequest(StrictModel):
    event_id: str = Field(min_length=3, max_length=128)
    student_id: str = Field(min_length=3, max_length=128)
    domain_code: str = Field(pattern=r"^[a-z0-9-]+$")
    course_id: str = Field(min_length=3, max_length=128)
    concept_code: str = Field(pattern=r"^[A-Z0-9_]+$")
    misconception_code: str | None = Field(default=None, pattern=r"^[A-Z0-9_]+$")
    current_state: CurrentState
    attempt: AttemptObservation
    recent_history: list[HistoryEvent] = Field(default_factory=list, max_length=100)
    prerequisite_mastery: float = Field(default=0.7, ge=0.0, le=1.0)
    course_progress: float = Field(default=0.3, ge=0.0, le=1.0)
    available_minutes: int = Field(default=15, ge=1, le=600)
    student_goal: str = Field(default="Nắm chắc kiến thức nền tảng", max_length=300)

    @field_validator("recent_history")
    @classmethod
    def newest_first_not_required(cls, value: list[HistoryEvent]) -> list[HistoryEvent]:
        return sorted(value, key=lambda item: item.occurred_at)


class DiagnosisResult(StrictModel):
    status: Literal["MATCHED", "UNKNOWN", "NEED_MORE_EVIDENCE"]
    concept_code: str
    misconception_code: str | None
    confidence: float = Field(ge=0.0, le=1.0)
    source: Literal["DOMAIN_RULE", "FALLBACK"]
    rule_id: str | None
    evidence: list[str]


class RecommendationResult(StrictModel):
    action: Literal[
        "FLASH_REVIEW",
        "MICRO_LESSON",
        "PRACTICE_SET",
        "PREREQUISITE_REVIEW",
        "CONTINUE_PATH",
        "CHECKPOINT",
        "GAME_PRACTICE",
        "TEACHER_SUPPORT",
    ]
    priority_score: float = Field(ge=0.0, le=1.0)
    reasons: list[str]
    evidence: dict[str, Any]


class AnalyzeEventResponse(StrictModel):
    event_id: str
    model_version: str
    mastery_before: float = Field(ge=0.0, le=1.0)
    mastery_after: float = Field(ge=0.0, le=1.0)
    observation_confidence: float = Field(ge=0.0, le=1.0)
    retrievability: float = Field(ge=0.0, le=1.0)
    forgetting_risk: float = Field(ge=0.0, le=1.0)
    recommended_interval_days: int = Field(ge=1, le=365)
    next_attempt_probability: float = Field(ge=0.0, le=1.0)
    diagnosis: DiagnosisResult
    recommendation: RecommendationResult
    explanations: list[str]
    mode: Literal["AI_SERVICE", "DETERMINISTIC_FALLBACK"] = "AI_SERVICE"
