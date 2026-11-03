import { expect, it } from "vitest";
import { downloadOnlyRedirect } from "./web-redirect";

const at = (url: string) => new Request(url);

it("sends browsers on the published site to the download page", () => {
  const r = downloadOnlyRedirect(at("https://mrbludo.lovable.app/play"));
  expect(r?.status).toBe(302);
  expect(r?.headers.get("location")).toBe("https://mrbludo.lovable.app/join");
});

it("keeps the invite code when redirecting", () => {
  const r = downloadOnlyRedirect(at("https://mrbludo.lovable.app/online?code=ABC234"));
  expect(r?.headers.get("location")).toBe("https://mrbludo.lovable.app/join?code=ABC234");
});

it("leaves the landing page, the admin, the app API and host files alone", () => {
  for (const url of [
    "https://mrbludo.lovable.app/join?code=ABC234",
    "https://mrbludo.lovable.app/admin-login",
    "https://mrbludo.lovable.app/api/public/native",
    "https://mrbludo.lovable.app/app-ads.txt",
    "https://mrbludo.lovable.app/.well-known/apple-app-site-association",
  ]) {
    expect(downloadOnlyRedirect(at(url))).toBeUndefined();
  }
});

it("never gates the dev server or a preview", () => {
  expect(downloadOnlyRedirect(at("http://localhost:8080/play"))).toBeUndefined();
  expect(downloadOnlyRedirect(at("https://id-preview--abc.lovable.app/online"))).toBeUndefined();
});
