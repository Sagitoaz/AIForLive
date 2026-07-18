import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoursePlanController } from "./course-plan.controller";
import { CoursePlanService } from "./course-plan.service";
import { TeacherController } from "./teacher.controller";

@Module({
  imports: [AuthModule],
  controllers: [TeacherController, CoursePlanController],
  providers: [CoursePlanService]
})
export class TeacherModule {}
