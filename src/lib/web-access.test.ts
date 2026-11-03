import { expect, it } from "vitest";
import { isDownloadOnlyVisitor, isPreviewHost, webPlayBlocked } from "./web-access";

it("never gates the app itself", () => {
  for (const host of ["localhost", "127.0.0.1", "id-preview--abc.lovable.app", "someone.lovableproject.com"]) {
    expect(webPlayBlocked({ hostname: host, pathname: "/online" })).toBe(false);
  }
  expect(webPlayBlocked({ hostname: "mrbludo.lovable.app", pathname: "/online", isNative: true })).toBe(false);
  expect(webPlayBlocked({ hostname: "mrbludo.lovable.app", pathname: "/online", isDev: true })).toBe(false);
});

it("keeps the landing page, the admin panel and the app's own API open", () => {
  for (const path of ["/join", "/auth", "/admin", "/admin-login", "/admin/anything", "/api/public/native"]) {
    expect(webPlayBlocked({ hostname: "mrbludo.lovable.app", pathname: path })).toBe(false);
  }
});

it("shows only the download page to ordinary visitors on the published site", () => {
  for (const path of ["/", "/play", "/setup", "/online", "/online/abc123", "/friends", "/stats", "/settings", "/rules"]) {
    expect(webPlayBlocked({ hostname: "mrbludo.lovable.app", pathname: path })).toBe(true);
  }
});

it("does not turn a download-page visitor into a player", () => {
  expect(isDownloadOnlyVisitor({ hostname: "mrbludo.lovable.app" })).toBe(true);
  expect(isDownloadOnlyVisitor({ hostname: "id-preview--abc.lovable.app" })).toBe(false);
  expect(isDownloadOnlyVisitor({ hostname: "mrbludo.lovable.app", isNative: true })).toBe(false);
  expect(isPreviewHost("localhost")).toBe(true);
});
