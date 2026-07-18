import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class GenerateContentDto {
  @IsString()
  domainCode = "python-foundations";

  @IsString()
  conceptCode!: string;

  @IsString()
  misconceptionCode!: string;

  @IsString()
  @MaxLength(100)
  level = "Mới bắt đầu";

  @IsString()
  @MaxLength(300)
  learningObjective = "Hiểu và áp dụng đúng khái niệm";

  @IsInt()
  @Min(3)
  @Max(15)
  durationMinutes = 5;

  @IsOptional()
  @IsString()
  sourceId = "source-python-handbook-01";

  @IsOptional()
  @IsIn(["LOCAL_TEMPLATE", "EXTERNAL_LLM", "MOCK_DEVELOPMENT"])
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM" | "MOCK_DEVELOPMENT" =
    process.env.AI_PROVIDER === "external-llm" ? "EXTERNAL_LLM" : "LOCAL_TEMPLATE";
}
