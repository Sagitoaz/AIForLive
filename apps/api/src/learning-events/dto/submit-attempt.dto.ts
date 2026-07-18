import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SubmitAttemptDto {
  @ApiProperty({ example: "web-demo-evt-001" })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  idempotencyKey!: string;

  @ApiPropertyOptional({ example: "student-minh" })
  @IsOptional()
  @IsString()
  studentId = "student-minh";

  @ApiProperty({ example: "python-foundations" })
  @IsString()
  domainCode = "python-foundations";

  @ApiProperty({ example: "course-python" })
  @IsString()
  courseId = "course-python";

  @ApiProperty({ example: "PYTHON_RANGE" })
  @IsString()
  conceptCode!: string;

  @ApiPropertyOptional({ example: "practice-range-predict-01" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  activityId?: string;

  @ApiPropertyOptional({ enum: ["THEORY", "PRACTICE", "CHECKPOINT"] })
  @IsOptional()
  @IsIn(["THEORY", "PRACTICE", "CHECKPOINT"])
  lessonPhase?: "THEORY" | "PRACTICE" | "CHECKPOINT";

  @ApiProperty({ example: false })
  @IsBoolean()
  isCorrect!: boolean;

  @IsBoolean()
  usedHint = false;

  @IsBoolean()
  skipped = false;

  @IsInt()
  @Min(1)
  @Max(100)
  attemptNumber = 1;

  @IsNumber()
  @Min(0)
  @Max(1)
  difficulty = 0.45;

  @IsInt()
  @Min(0)
  @Max(3_600_000)
  responseTimeMs = 12_500;

  @IsString()
  @MaxLength(2_000)
  submittedAnswer!: string;

  @IsString()
  @MaxLength(2_000)
  expectedAnswer!: string;

  @IsOptional()
  @IsInt()
  stopValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  prerequisiteMastery = 0.72;
}

export class LearningEventDto {
  @IsString()
  @MinLength(3)
  idempotencyKey!: string;

  @IsString()
  type!: string;

  @IsString()
  studentId!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
