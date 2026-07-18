import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { LearningEventDto, SubmitAttemptDto } from "./dto/submit-attempt.dto";
import { LearningService } from "./learning.service";

@ApiTags("learning")
@ApiBearerAuth()
@Roles("STUDENT")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Post("learning-events")
  event(@Req() request: AuthenticatedRequest, @Body() body: LearningEventDto): Record<string, unknown> {
    body.studentId = request.user.id;
    return this.learning.recordEvent(body);
  }

  @Post("attempts")
  attempt(@Req() request: AuthenticatedRequest, @Body() body: SubmitAttemptDto) {
    body.studentId = request.user.id;
    return this.learning.submitAttempt(body);
  }

  @Get("attempts/:id/analysis")
  analysis(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const attempt = this.learning.analysis(id);
    if (attempt.studentId !== request.user.id) throw new NotFoundException("Attempt not found");
    return attempt;
  }
}
