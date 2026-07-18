import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoursesController, StudentsController } from "./students.controller";

@Module({ imports: [AuthModule], controllers: [StudentsController, CoursesController] })
export class StudentsModule {}
