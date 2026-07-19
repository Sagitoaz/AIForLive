import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuthService } from "./auth.service";

const originalEnv = { ...process.env };

describe("AuthService demo accounts", () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const prisma = {
    user: { findMany, findFirst }
  } as unknown as PrismaService;
  const jwt = {} as JwtService;
  const service = new AuthService(jwt, prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns only the public identity fields of active synthetic demo accounts", async () => {
    findMany.mockResolvedValue([
      {
        id: "student-user-id",
        displayName: "Minh",
        email: "minh@edurecall.local",
        role: UserRole.STUDENT,
        avatarKey: "avatar-01",
        metadataJson: {
          synthetic: true,
          demoAccount: true,
          description: "Học sinh demo",
          internalFixtureNote: "must not be returned"
        },
        passwordHash: "must-not-leak"
      }
    ]);

    const result = await service.demoAccounts();
    expect(result).toEqual([
      {
        id: "student-user-id",
        displayName: "Minh",
        email: "minh@edurecall.local",
        role: UserRole.STUDENT,
        avatar: "avatar-01",
        classRoles: [],
        description: "Học sinh demo"
      }
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            status: "ACTIVE",
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
            classes: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
            classMemberships: {
              where: { status: "ACTIVE", deletedAt: null },
              select: { role: true }
            }
          }
        }
      },
      orderBy: [{ role: "desc" }, { displayName: "asc" }]
    });
    expect(result[0]).not.toHaveProperty("passwordHash");
  });

  it("looks up the authenticated identity by token subject and active status", async () => {
    findFirst.mockResolvedValue({
      id: "teacher-user-id",
      email: "teacher@edurecall.local",
      displayName: "Cô Mai",
      role: UserRole.TEACHER,
      avatarKey: "avatar-24",
      teacherProfile: {
        classes: [{ id: "class-1" }],
        classMemberships: [{ role: "OWNER" }]
      }
    });

    await expect(service.findById("teacher-user-id")).resolves.toEqual({
      id: "teacher-user-id",
      email: "teacher@edurecall.local",
      displayName: "Cô Mai",
      role: UserRole.TEACHER,
      avatar: "avatar-24",
      classRoles: ["OWNER"]
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "teacher-user-id", status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatarKey: true,
        teacherProfile: {
          select: {
            classes: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
            classMemberships: {
              where: { status: "ACTIVE", deletedAt: null },
              select: { role: true }
            }
          }
        }
      }
    });
  });

  it("uses validated token TTL settings and returns the real access lifetime", async () => {
    process.env.JWT_ACCESS_SECRET = "access-test-secret";
    process.env.JWT_REFRESH_SECRET = "refresh-test-secret";
    process.env.JWT_ACCESS_TTL = "45m";
    process.env.JWT_REFRESH_TTL = "10d";
    const signAsync = jest.fn()
      .mockResolvedValueOnce("signed-access")
      .mockResolvedValueOnce("signed-refresh");
    const tokenService = new AuthService({ signAsync } as unknown as JwtService, prisma);
    const issueTokens = (
      tokenService as unknown as {
        tokens: (user: Record<string, unknown>) => Promise<Record<string, unknown>>;
      }
    ).tokens.bind(tokenService);

    const result = await issueTokens({
      id: "student-user-id",
      email: "student@example.test",
      displayName: "Student",
      role: UserRole.STUDENT,
      avatarKey: null,
      classRoles: []
    });

    expect(signAsync).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "access" }), {
      secret: "access-test-secret",
      expiresIn: "45m"
    });
    expect(signAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "refresh" }), {
      secret: "refresh-test-secret",
      expiresIn: "10d"
    });
    expect(result).toMatchObject({
      accessToken: "signed-access",
      refreshToken: "signed-refresh",
      expiresInSeconds: 2_700
    });
  });
});
