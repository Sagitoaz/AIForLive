import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeacherController } from "./teacher.controller";

@Module({ imports: [AuthModule], controllers: [TeacherController] })
export class TeacherModule {}
