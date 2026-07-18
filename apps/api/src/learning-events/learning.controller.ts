import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LearningEventDto, SubmitAttemptDto } from "./dto/submit-attempt.dto";
import { LearningService } from "./learning.service";

@ApiTags("learning")
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Post("learning-events")
  event(@Body() body: LearningEventDto): Record<string, unknown> {
    return this.learning.recordEvent(body);
  }

  @Post("attempts")
  attempt(@Body() body: SubmitAttemptDto) {
    return this.learning.submitAttempt(body);
  }

  @Get("attempts/:id/analysis")
  analysis(@Param("id") id: string) {
    return this.learning.analysis(id);
  }
}
