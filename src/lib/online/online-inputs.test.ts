import { describe, expect, it } from "vitest";
import { getAvatarsInput, setAvatarInput } from "./online-inputs";

const UUID = "3f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const jpeg = `data:image/jpeg;base64,${"A".repeat(4000)}`;

describe("profile picture input", () => {
  it("accepts a small jpeg picture", () => {
    expect(setAvatarInput({ image: jpeg }).image).toBe(jpeg);
  });

  it("accepts removing the picture", () => {
    expect(setAvatarInput({ image: null })).toEqual({ image: null });
    expect(setAvatarInput({ image: "" })).toEqual({ image: null });
  });

  it("rejects anything that is not a picture", () => {
    expect(() => setAvatarInput({ image: "https://example.com/a.jpg" })).toThrow("err:bad_image");
    expect(() => setAvatarInput({ image: "data:text/html;base64,AAA" })).toThrow("err:bad_image");
    expect(() => setAvatarInput({ image: "data:image/svg+xml;base64,AAA" })).toThrow("err:bad_image");
  });

  it("rejects a picture bigger than the stored limit", () => {
    expect(() => setAvatarInput({ image: `data:image/jpeg;base64,${"A".repeat(119978)}` })).toThrow("err:image_too_large");
    expect(setAvatarInput({ image: `data:image/jpeg;base64,${"A".repeat(119977)}` }).image?.length).toBe(120000);
  });

  it("only asks for real player ids, once each", () => {
    expect(getAvatarsInput({ userIds: [UUID, UUID, "not-a-uuid", ""] }).userIds).toEqual([UUID]);
  });

  it("never asks for more players than the page can show", () => {
    const many = Array.from({ length: 200 }, (_, i) => `${i.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`);
    expect(getAvatarsInput({ userIds: many }).userIds).toHaveLength(60);
  });

  it("asks nothing when there is nobody to show", () => {
    expect(() => getAvatarsInput({ userIds: ["nope"] })).toThrow("err:missing");
  });
});
