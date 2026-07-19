import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class GenerateContentDto {
  @IsString()
  domainCode = "python-foundations";

  @IsString()
  @IsNotEmpty()
  conceptCode!: string;

  @ValidateIf((input: GenerateContentDto, value: unknown) => input.draftKind === "REMEDIATION" || value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  misconceptionCode?: string;

  @IsString()
  @MaxLength(100)
  level = "Mới bắt đầu";

  @IsString()
  @MaxLength(300)
  learningObjective = "Hiểu và áp dụng đúng khái niệm";

  @IsInt()
  @Min(3)
  @Max(120)
  durationMinutes = 5;

  @IsOptional()
  @IsIn(["FULL_LESSON", "REMEDIATION"])
  draftKind: "FULL_LESSON" | "REMEDIATION" = "REMEDIATION";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gradeBand = "Lớp 6–9";

  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsOptional()
  @IsIn(["LOCAL_TEMPLATE", "EXTERNAL_LLM"])
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM" =
    process.env.AI_PROVIDER === "external-llm" ? "EXTERNAL_LLM" : "LOCAL_TEMPLATE";
}
