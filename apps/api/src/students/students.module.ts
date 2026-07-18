import { Module } from "@nestjs/common";
import { CoursesController, StudentsController } from "./students.controller";

@Module({ controllers: [StudentsController, CoursesController] })
export class StudentsModule {}
