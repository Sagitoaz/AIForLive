import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class GenerateCoursePlanDto {
  @IsString()
  @MaxLength(100)
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  className?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsString()
  @MaxLength(80)
  gradeBand!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  goals!: string[];

  @IsInt()
  @Min(1)
  @Max(52)
  durationWeeks!: number;
}

export class EditCoursePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gradeBand?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  goals?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  durationWeeks?: number;

  @IsOptional()
  @IsObject()
  planJson?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  teacherEditingSeconds?: number;
}

export class CoursePlanActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  comment?: string;
}
