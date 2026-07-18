import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CoursePlanService } from "./course-plan.service";
import {
  CoursePlanActionDto,
  EditCoursePlanDto,
  GenerateCoursePlanDto
} from "./dto/course-plan.dto";

@ApiTags("teacher-course-plans")
@ApiBearerAuth()
@Roles("TEACHER")
@UseGuards(AuthGuard, RolesGuard)
@Controller("teacher/course-plans")
export class CoursePlanController {
  constructor(private readonly coursePlans: CoursePlanService) {}

  @Post("generate")
  generate(@Req() request: AuthenticatedRequest, @Body() body: GenerateCoursePlanDto) {
    return this.coursePlans.generate(body, request.user.id);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.coursePlans.list(request.user.id);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.coursePlans.get(id, request.user.id);
  }

  @Patch(":id")
  edit(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: EditCoursePlanDto
  ) {
    return this.coursePlans.edit(id, body, request.user.id);
  }

  @Post(":id/submit-review")
  submitReview(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: CoursePlanActionDto
  ) {
    return this.coursePlans.submitReview(id, body, request.user.id);
  }

  @Post(":id/approve")
  approve(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: CoursePlanActionDto
  ) {
    return this.coursePlans.approve(id, body, request.user.id);
  }

  @Post(":id/request-revision")
  requestRevision(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: CoursePlanActionDto
  ) {
    return this.coursePlans.requestRevision(id, body, request.user.id);
  }

  @Post(":id/publish")
  publish(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: CoursePlanActionDto
  ) {
    return this.coursePlans.publish(id, body, request.user.id);
  }
}
