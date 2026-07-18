import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "./auth.guard";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto): Promise<Record<string, unknown>> {
    return this.auth.login(body.email, body.password);
  }

  @Post("refresh")
  refresh(@Body() body: RefreshDto): Promise<Record<string, unknown>> {
    return this.auth.refresh(body.refreshToken);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthenticatedRequest["user"] {
    return request.user;
  }
}
