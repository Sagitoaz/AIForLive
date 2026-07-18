export interface RecommendationSignals {
  knowledgeGap: number;
  forgettingRisk: number;
  recentErrorRate: number;
  prerequisiteImportance: number;
  courseRelevance: number;
  repeatedMisconceptionCount: number;
  availableMinutes: number;
}

export const RECOMMENDATION_WEIGHTS = {
  knowledgeGap: 0.35,
  forgettingRisk: 0.25,
  recentErrorRate: 0.2,
  prerequisiteImportance: 0.1,
  courseRelevance: 0.1
} as const;
