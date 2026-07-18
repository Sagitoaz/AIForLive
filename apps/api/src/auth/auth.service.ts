import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, RecordStatus, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../common/types";
import { PrismaService } from "../database/prisma.service";

type AuthUserRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async login(email: string, password: string): Promise<Record<string, unknown>> {
    const credential = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), status: RecordStatus.ACTIVE, deletedAt: null }
    });
    if (!credential || !(await bcrypt.compare(password, credential.passwordHash))) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: credential.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.auditLog.create({
        data: {
          actorId: credential.id,
          action: AuditAction.LOGIN,
          entityType: "User",
          entityId: credential.id,
          correlationId: randomUUID(),
          metadataJson: { source: "password" }
        }
      })
    ]);
    return this.tokens(credential);
  }

  async refresh(refreshToken: string): Promise<Record<string, unknown>> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(refreshToken, {
        secret: this.refreshSecret()
      });
      if (payload.type !== "refresh") throw new Error("Invalid token type");
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: RecordStatus.ACTIVE, deletedAt: null }
      });
      if (!user) throw new Error("Unknown user");
      return this.tokens(user);
    } catch {
      throw new UnauthorizedException("Refresh token không hợp lệ hoặc đã hết hạn");
    }
  }

  async verifyAccess(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token, {
      secret: this.accessSecret()
    });
    if (payload.type !== "access") throw new UnauthorizedException("Token không hợp lệ");
    const user = await this.findById(payload.sub);
    if (!user) throw new UnauthorizedException("Token không hợp lệ");
    return user;
  }

  async findById(id: string): Promise<AuthenticatedUser | undefined> {
    const user = await this.prisma.user.findFirst({
      where: { id, status: RecordStatus.ACTIVE, deletedAt: null },
      select: { id: true, email: true, displayName: true, role: true }
    });
    return user ? this.publicUser(user) : undefined;
  }

  private async tokens(user: AuthUserRow): Promise<Record<string, unknown>> {
    const publicUser = this.publicUser(user);
    const accessToken = await this.jwt.signAsync(
      { ...publicUser, sub: user.id, type: "access" },
      { secret: this.accessSecret(), expiresIn: "15m" }
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: "refresh" },
      { secret: this.refreshSecret(), expiresIn: "7d" }
    );
    return { accessToken, refreshToken, tokenType: "Bearer", expiresInSeconds: 900, user: publicUser };
  }

  private publicUser(user: AuthUserRow): AuthenticatedUser {
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }

  private accessSecret(): string {
    const value = process.env.JWT_ACCESS_SECRET;
    if (!value) throw new Error("JWT_ACCESS_SECRET is required");
    return value;
  }

  private refreshSecret(): string {
    const value = process.env.JWT_REFRESH_SECRET;
    if (!value) throw new Error("JWT_REFRESH_SECRET is required");
    return value;
  }
}
