import { SetMetadata } from "@nestjs/common";
import type { DemoRole } from "../common/types";

export const ROLES_KEY = "roles";
export const Roles = (...roles: DemoRole[]) => SetMetadata(ROLES_KEY, roles);
