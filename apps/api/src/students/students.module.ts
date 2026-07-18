import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LessonProgressService } from "./lesson-progress.service";
import { CoursesController, StudentsController } from "./students.controller";

@Module({
  imports: [AuthModule],
  controllers: [StudentsController, CoursesController],
  providers: [LessonProgressService]
})
export class StudentsModule {}
