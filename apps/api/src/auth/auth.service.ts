import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import type { AuthenticatedUser, DemoRole } from "../common/types";

interface DemoCredential extends AuthenticatedUser {
  passwordHash: string;
}

@Injectable()
export class AuthService {
  private readonly credentials: DemoCredential[] = [
    this.credential("teacher", "teacher@edurecall.local", "Cô Mai", "TEACHER"),
    this.credential("student-minh", "minh@edurecall.local", "Minh", "STUDENT"),
    this.credential("student-lan", "lan@edurecall.local", "Lan", "STUDENT")
  ];

  constructor(private readonly jwt: JwtService) {}

  private credential(id: string, email: string, displayName: string, role: DemoRole): DemoCredential {
    return { id, email, displayName, role, passwordHash: bcrypt.hashSync("Demo@123", 6) };
  }

  async login(email: string, password: string): Promise<Record<string, unknown>> {
    const credential = this.credentials.find((item) => item.email === email.toLowerCase());
    if (!credential || !(await bcrypt.compare(password, credential.passwordHash))) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }
    return this.tokens(credential);
  }

  async refresh(refreshToken: string): Promise<Record<string, unknown>> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "demo-refresh-secret-change-me"
      });
      if (payload.type !== "refresh") throw new Error("Invalid token type");
      const user = this.credentials.find((item) => item.id === payload.sub);
      if (!user) throw new Error("Unknown user");
      return this.tokens(user);
    } catch {
      throw new UnauthorizedException("Refresh token không hợp lệ hoặc đã hết hạn");
    }
  }

  async verifyAccess(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwt.verifyAsync<AuthenticatedUser & { sub: string }>(token, {
      secret: process.env.JWT_ACCESS_SECRET ?? "demo-access-secret-change-me"
    });
    const user = this.credentials.find((item) => item.id === payload.sub);
    if (!user) throw new UnauthorizedException("Token không hợp lệ");
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }

  findById(id: string): AuthenticatedUser | undefined {
    const user = this.credentials.find((item) => item.id === id);
    return user ? { id: user.id, email: user.email, displayName: user.displayName, role: user.role } : undefined;
  }

  private async tokens(user: DemoCredential): Promise<Record<string, unknown>> {
    const publicUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role
    };
    const accessToken = await this.jwt.signAsync(
      { ...publicUser, sub: user.id, type: "access" },
      { secret: process.env.JWT_ACCESS_SECRET ?? "demo-access-secret-change-me", expiresIn: "15m" }
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: "refresh" },
      { secret: process.env.JWT_REFRESH_SECRET ?? "demo-refresh-secret-change-me", expiresIn: "7d" }
    );
    return { accessToken, refreshToken, tokenType: "Bearer", expiresInSeconds: 900, user: publicUser };
  }
}
