import { expect, it } from "vitest";
import { nativeServices, prepareAds, preparePush } from "./services";
it("does not activate production ads", async () => {
  expect((await prepareAds()).enabled).toBe(false);
  expect(nativeServices.advertising.appIds).toBeNull();
});
it("does not register or send real push notifications", async () => {
  expect((await preparePush()).enabled).toBe(false);
  expect(nativeServices.push.registerOnLaunch).toBe(false);
});