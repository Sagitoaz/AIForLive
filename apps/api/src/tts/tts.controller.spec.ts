import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthGuard } from "../auth/auth.guard";
import { TtsController } from "./tts.controller";

describe("TtsController provider quota boundary", () => {
  it("requires an authenticated session for every speech request", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TtsController) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});
