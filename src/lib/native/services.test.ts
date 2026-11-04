import { expect, it } from "vitest";
import { nativeServices, preparePush } from "./services";
it("push is on for iOS but never asks for permission at launch", async () => {
  expect((await preparePush()).enabled).toBe(true);
  expect(nativeServices.push.registerOnLaunch).toBe(false);
  expect(nativeServices.push.platforms).toEqual(["ios"]);
});
