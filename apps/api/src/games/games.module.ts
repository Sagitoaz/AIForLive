import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamesController } from "./games.controller";

@Module({ imports: [AuthModule], controllers: [GamesController] })
export class GamesModule {}
