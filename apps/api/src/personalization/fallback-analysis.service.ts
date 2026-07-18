import { Injectable } from "@nestjs/common";
import type { AnalysisResult } from "../common/types";
import type { SubmitAttemptDto } from "../learning-events/dto/submit-attempt.dto";

@Injectable()
export class FallbackAnalysisService {
  analyze(eventId: string, dto: SubmitAttemptDto, mastery: number): AnalysisResult {
    const confidence = dto.usedHint ? 0.48 : dto.skipped ? 0.2 : 0.82;
    const delta = dto.isCorrect ? 0.12 * confidence : -0.09 * confidence;
    const masteryAfter = Math.max(0.02, Math.min(0.98, mastery + delta));
    const rangeStop =
      !dto.isCorrect &&
      dto.conceptCode === "PYTHON_RANGE" &&
      dto.stopValue !== undefined &&
      dto.submittedAnswer.split(/\D+/).filter(Boolean).map(Number).includes(dto.stopValue);
    const misconception = rangeStop ? "RANGE_STOP_INCLUDED" : null;
    const forgettingRisk = Number(Math.max(0.15, 0.72 - masteryAfter * 0.55).toFixed(4));
    return {
      event_id: eventId,
      model_version: "fallback-v1",
      mastery_before: mastery,
      mastery_after: Number(masteryAfter.toFixed(4)),
      observation_confidence: confidence,
      retrievability: Number((1 - forgettingRisk).toFixed(4)),
      forgetting_risk: forgettingRisk,
      recommended_interval_days: Math.max(1, Math.round(1 + masteryAfter * 4)),
      next_attempt_probability: Number((0.2 + masteryAfter * 0.65).toFixed(4)),
      diagnosis: {
        status: misconception ? "MATCHED" : "UNKNOWN",
        concept_code: dto.conceptCode,
        misconception_code: misconception,
        confidence: misconception ? 0.9 : 0.25,
        source: misconception ? "DOMAIN_RULE" : "FALLBACK",
        rule_id: misconception ? "range-stop-rule-v1" : null,
        evidence: misconception
          ? ["Submitted sequence contains the stop value", "Expected sequence excludes the stop value"]
          : ["No deterministic fallback rule matched"]
      },
      recommendation: {
        action: misconception ? "MICRO_LESSON" : masteryAfter < 0.5 ? "PRACTICE_SET" : "CONTINUE_PATH",
        priority_score: Number((0.35 * (1 - masteryAfter) + 0.25 * forgettingRisk + 0.2 * (dto.isCorrect ? 0 : 1) + 0.17).toFixed(4)),
        reasons: [
          `Mastery của concept hiện ở mức ${Math.round(masteryAfter * 100)}%`,
          `Nguy cơ quên ước tính ${Math.round(forgettingRisk * 100)}%`,
          ...(misconception ? ["Domain rule xác nhận RANGE_STOP_INCLUDED"] : [])
        ],
        evidence: { attemptIds: [eventId], modelVersion: "fallback-v1", ruleId: misconception ? "range-stop-rule-v1" : null }
      },
      explanations: [
        "Personalization fallback mode: attempt vẫn được lưu khi Python service không sẵn sàng.",
        "Knowledge tracing đo mức hiểu; forgetting model đo nguy cơ quên.",
        "Recommendation reason được tạo từ các signal, không do LLM bịa."
      ],
      mode: "DETERMINISTIC_FALLBACK"
    };
  }
}
