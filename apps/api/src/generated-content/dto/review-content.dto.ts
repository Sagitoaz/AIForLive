import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class SlideEditDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsString()
  @MaxLength(1_200)
  body!: string;

  @IsString()
  @MaxLength(1_600)
  narration!: string;
}

class QuizEditDto {
  @IsString()
  question!: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctIndex!: number;

  @IsString()
  explanation!: string;
}

export class EditContentDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  teacherEditingSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlideEditDto)
  slides?: SlideEditDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizEditDto)
  quiz?: QuizEditDto;
}

export class ReviewActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  comment?: string;
}
