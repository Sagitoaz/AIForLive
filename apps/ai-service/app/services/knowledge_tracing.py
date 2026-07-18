from __future__ import annotations

from dataclasses import dataclass

from app.schemas.personalization import AttemptObservation


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class BktParameters:
    p_l0: float = 0.28
    p_transit: float = 0.08
    p_guess: float = 0.2
    p_slip: float = 0.1


@dataclass(frozen=True)
class BktUpdate:
    mastery_before: float
    mastery_after: float
    observation_confidence: float


class BayesianKnowledgeTracer:
    def __init__(self, parameters: BktParameters | None = None) -> None:
        self.parameters = parameters or BktParameters()

    def observation_confidence(self, attempt: AttemptObservation) -> float:
        if attempt.skipped:
            return 0.2
        confidence = 0.93
        if attempt.used_hint:
            confidence *= 0.58
        if attempt.attempt_number > 1:
            confidence *= max(0.55, 1.0 - 0.09 * (attempt.attempt_number - 1))
        if attempt.difficulty < 0.2 or attempt.difficulty > 0.9:
            confidence *= 0.88
        if attempt.response_time_ms < 900:
            confidence *= 0.55
        elif attempt.response_time_ms > 180_000:
            confidence *= 0.65
        return clamp(confidence, 0.15, 0.98)

    def update(self, mastery: float, attempt: AttemptObservation) -> BktUpdate:
        prior = clamp(mastery, 0.01, 0.99)
        confidence = self.observation_confidence(attempt)
        params = self.parameters

        if attempt.skipped:
            observed = prior
        elif attempt.is_correct:
            numerator = prior * (1.0 - params.p_slip)
            denominator = numerator + (1.0 - prior) * params.p_guess
            observed = numerator / max(denominator, 1e-9)
        else:
            numerator = prior * params.p_slip
            denominator = numerator + (1.0 - prior) * (1.0 - params.p_guess)
            observed = numerator / max(denominator, 1e-9)

        blended = prior + (observed - prior) * confidence
        learned = blended + (1.0 - blended) * params.p_transit * confidence
        result = clamp(learned, 0.01, 0.99)
        return BktUpdate(round(prior, 4), round(result, 4), round(confidence, 4))
