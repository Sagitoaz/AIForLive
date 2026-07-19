from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IdeaRubricCriterion(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    weight: float = Field(gt=0.0, le=100.0)
    aliases: list[str] = Field(min_length=1, max_length=30)
    required: bool = False

    @field_validator("id", "description")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("rubric text must not be blank")
        return cleaned

    @field_validator("aliases")
    @classmethod
    def clean_aliases(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item or len(item) > 300 for item in cleaned):
            raise ValueError("aliases must contain non-empty strings up to 300 characters")
        return cleaned


class IdeaRubric(StrictModel):
    version: str = Field(min_length=1, max_length=160)
    criteria: list[IdeaRubricCriterion] = Field(min_length=1, max_length=12)

    @field_validator("version")
    @classmethod
    def strip_version(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("rubric version must not be blank")
        return cleaned

    @model_validator(mode="after")
    def unique_criterion_ids(self) -> IdeaRubric:
        identifiers = [criterion.id for criterion in self.criteria]
        if len(set(identifiers)) != len(identifiers):
            raise ValueError("criterion IDs must be unique")
        return self


class IdeaGradingRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=2_000)
    submission: str = Field(min_length=1, max_length=2_000)
    rubric: IdeaRubric

    @field_validator("prompt", "submission")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("prompt and submission must not be blank")
        return cleaned


class IdeaCriterionEvaluation(StrictModel):
    criterion_id: str = Field(min_length=1, max_length=120)
    coverage: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list, max_length=5)
    feedback: str = Field(min_length=1, max_length=500)

    @field_validator("criterion_id", "feedback")
    @classmethod
    def strip_evaluation_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("evaluation text must not be blank")
        return cleaned

    @field_validator("evidence")
    @classmethod
    def clean_evidence(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item or len(item) > 300 for item in cleaned):
            raise ValueError("evidence must contain non-empty excerpts up to 300 characters")
        return cleaned


class IdeaGradingTrace(StrictModel):
    provider: str
    prompt_hash: str
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    estimated_cost_usd: float = Field(ge=0.0)
    latency_ms: int = Field(ge=0)


class IdeaGradingResponse(StrictModel):
    mode: Literal["EXTERNAL_LLM"] = "EXTERNAL_LLM"
    model: str
    prompt_version: str
    rubric_version: str
    criteria: list[IdeaCriterionEvaluation]
    confidence: float = Field(ge=0.0, le=1.0)
    trace: IdeaGradingTrace


class ProviderIdeaEvaluation(StrictModel):
    criteria: list[IdeaCriterionEvaluation]
    confidence: float = Field(ge=0.0, le=1.0)
