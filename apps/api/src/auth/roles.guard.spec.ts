import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  it("rejects a student from a teacher-only handler", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["TEACHER"]) } as unknown as Reflector;
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: "STUDENT" } }) })
    } as unknown as ExecutionContext;
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(ForbiddenException);
  });

  it("accepts the configured role", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["TEACHER"]) } as unknown as Reflector;
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: "TEACHER" } }) })
    } as unknown as ExecutionContext;
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });
});
