import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
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
  event(@Req() request: AuthenticatedRequest, @Body() body: LearningEventDto): Promise<Record<string, unknown>> {
    return this.learning.recordEvent(request.user.id, body);
  }

  @Post("attempts")
  attempt(@Req() request: AuthenticatedRequest, @Body() body: SubmitAttemptDto) {
    return this.learning.submitAttempt(request.user.id, body);
  }

  @Get("attempts/:id/analysis")
  analysis(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.learning.analysis(id, request.user.id);
  }
}
