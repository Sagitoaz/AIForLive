import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export type AttemptSubmissionKind = "TEXT" | "PSEUDOCODE" | "CODE_ORDER";

export class AttemptSubmissionDto {
  @ApiProperty({ enum: ["TEXT", "PSEUDOCODE", "CODE_ORDER"] })
  @IsIn(["TEXT", "PSEUDOCODE", "CODE_ORDER"])
  kind!: AttemptSubmissionKind;

  @ApiPropertyOptional({ description: "Learner-authored answer or pseudocode. Syntax is not authoritative." })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  text?: string;

  @ApiPropertyOptional({ description: "Stable public block IDs in the learner-selected order." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  blockIds?: string[];
}

export class SubmitAttemptDto {
  @ApiProperty({ example: "web-demo-evt-001" })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  idempotencyKey!: string;

  @ApiProperty({ example: "course-python" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  courseId!: string;

  @ApiProperty({ example: "practice-range-predict-01" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  activityId!: string;

  @ApiProperty({ type: AttemptSubmissionDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AttemptSubmissionDto)
  submission!: AttemptSubmissionDto;

  @IsBoolean()
  usedHint = false;

  @IsBoolean()
  skipped = false;

  @IsInt()
  @Min(0)
  @Max(3_600_000)
  responseTimeMs = 12_500;
}

/**
 * Internal, server-owned observation passed to personalization. None of the
 * authoritative fields in this interface are accepted from the public DTO.
 */
export interface ScoredAttemptInput {
  idempotencyKey: string;
  studentId: string;
  domainCode: string;
  courseId: string;
  conceptCode: string;
  activityId: string;
  lessonPhase: "THEORY" | "PRACTICE" | "CHECKPOINT";
  isCorrect: boolean;
  usedHint: boolean;
  skipped: boolean;
  attemptNumber: number;
  difficulty: number;
  responseTimeMs: number;
  submittedAnswer: string;
  expectedAnswer: string;
  stopValue?: number;
  prerequisiteMastery: number;
}

export class LearningEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  idempotencyKey!: string;

  @IsString()
  type!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
