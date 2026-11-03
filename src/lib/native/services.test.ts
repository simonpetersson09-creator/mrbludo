import { expect, it } from "vitest";
import { nativeServices, preparePush } from "./services";
it("does not register or send real push notifications", async () => {
  expect((await preparePush()).enabled).toBe(false);
  expect(nativeServices.push.registerOnLaunch).toBe(false);
});
