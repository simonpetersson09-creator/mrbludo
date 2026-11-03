import { describe, expect, it } from "vitest";
import { deepLinkPath } from "./deep-link";

describe("deepLinkPath", () => {
  it("opens a Ludo universal invite link", () => expect(deepLinkPath("https://mrbludo.lovable.app/online?code=ABC234")).toMatch(/^\/online\?code=/));
  it("opens the app's QR scheme", () => expect(deepLinkPath("mrbludo://join?code=ABC234")).toMatch(/^\/online\?code=/));
  it("ignores other domains such as Yatzy", () => expect(deepLinkPath("https://mrbyatzy.lovable.app/online?code=ABC234")).toBeNull());
});
