import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { AuditAction, ClassTeacherRole, RecordStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../common/types";
import { PrismaService } from "../database/prisma.service";

type AuthUserRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarKey: string | null;
  classRoles?: ClassTeacherRole[];
};

type TeacherAccess = {
  teacherProfile?: {
    classes: Array<{ id: string }>;
    classMemberships: Array<{ role: ClassTeacherRole }>;
  } | null;
};

function teacherClassRoles(row: TeacherAccess): ClassTeacherRole[] {
  const roles = new Set(row.teacherProfile?.classMemberships.map((membership) => membership.role) ?? []);
  if (row.teacherProfile?.classes.length) roles.add(ClassTeacherRole.OWNER);
  return [...roles];
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async demoAccounts(): Promise<Record<string, unknown>[]> {
    const demoMode = process.env.DEMO_MODE === "true"
      || (process.env.DEMO_MODE !== "false" && process.env.NODE_ENV !== "production");
    if (!demoMode) return [];
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            status: RecordStatus.ACTIVE,
            deletedAt: null,
            role: { in: [UserRole.STUDENT, UserRole.TEACHER] }
          },
          { metadataJson: { path: ["synthetic"], equals: true } },
          { metadataJson: { path: ["demoAccount"], equals: true } }
        ]
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        avatarKey: true,
        metadataJson: true,
        teacherProfile: {
          select: {
            classes: { where: { status: RecordStatus.ACTIVE, deletedAt: null }, select: { id: true } },
            classMemberships: {
              where: { status: RecordStatus.ACTIVE, deletedAt: null },
              select: { role: true }
            }
          }
        }
      },
      orderBy: [{ role: "desc" }, { displayName: "asc" }]
    });
    return rows.map((row) => {
      const metadata = objectMetadata(row.metadataJson);
      return {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        role: row.role,
        avatar: row.avatarKey,
        classRoles: teacherClassRoles(row),
        description: typeof metadata.description === "string" ? metadata.description : "Tài khoản demo tổng hợp"
      };
    });
  }

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
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatarKey: true,
        teacherProfile: {
          select: {
            classes: { where: { status: RecordStatus.ACTIVE, deletedAt: null }, select: { id: true } },
            classMemberships: {
              where: { status: RecordStatus.ACTIVE, deletedAt: null },
              select: { role: true }
            }
          }
        }
      }
    });
    return user ? this.publicUser({ ...user, classRoles: teacherClassRoles(user) }) : undefined;
  }

  private async tokens(user: AuthUserRow): Promise<Record<string, unknown>> {
    const publicUser = this.publicUser(user);
    const accessTtl = this.tokenTtl("JWT_ACCESS_TTL", "15m", 15 * 60, 24 * 60 * 60);
    const refreshTtl = this.tokenTtl("JWT_REFRESH_TTL", "7d", 7 * 24 * 60 * 60, 30 * 24 * 60 * 60);
    const accessToken = await this.jwt.signAsync(
      { ...publicUser, sub: user.id, type: "access" },
      { secret: this.accessSecret(), expiresIn: accessTtl.expiresIn }
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: "refresh" },
      { secret: this.refreshSecret(), expiresIn: refreshTtl.expiresIn }
    );
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresInSeconds: accessTtl.seconds,
      user: publicUser
    };
  }

  private tokenTtl(
    key: "JWT_ACCESS_TTL" | "JWT_REFRESH_TTL",
    fallback: string,
    fallbackSeconds: number,
    maximumSeconds: number
  ): { expiresIn: JwtSignOptions["expiresIn"]; seconds: number } {
    const raw = process.env[key]?.trim() ?? fallback;
    const match = raw.match(/^([1-9]\d*)([smhd])$/);
    const units = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
    if (!match) {
      return { expiresIn: fallback as JwtSignOptions["expiresIn"], seconds: fallbackSeconds };
    }
    const seconds = Number(match[1]) * units[match[2] as keyof typeof units];
    if (!Number.isSafeInteger(seconds) || seconds > maximumSeconds) {
      return { expiresIn: fallback as JwtSignOptions["expiresIn"], seconds: fallbackSeconds };
    }
    return { expiresIn: raw as JwtSignOptions["expiresIn"], seconds };
  }

  private publicUser(user: AuthUserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatarKey,
      classRoles: user.classRoles ?? []
    };
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
