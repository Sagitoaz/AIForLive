export interface AnalyzeEventRequest {
  event_id: string;
  student_id: string;
  domain_code: string;
  course_id: string;
  concept_code: string;
  current_state: { mastery: number; stability: number; retrievability: number };
  attempt: {
    is_correct: boolean;
    used_hint: boolean;
    attempt_number: number;
    difficulty: number;
    response_time_ms: number;
    skipped?: boolean;
    submitted_answer?: string;
    expected_answer?: string;
  };
  recent_history: Array<{ is_correct: boolean; used_hint: boolean; occurred_at: string }>;
}

export interface AnalyzeEventResponse {
  event_id: string;
  model_version: string;
  mastery_before: number;
  mastery_after: number;
  observation_confidence: number;
  retrievability: number;
  forgetting_risk: number;
  diagnosis: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  explanations: string[];
  mode: "AI_SERVICE" | "DETERMINISTIC_FALLBACK";
}
