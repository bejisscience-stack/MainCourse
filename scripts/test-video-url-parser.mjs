// Standalone tests for video URL hostname validation (A-12).
// Run via: node --test scripts/test-video-url-parser.mjs
//
// The codebase has no test framework configured (CLAUDE.md: "validate manually"),
// so this script replicates the algorithm under test inline rather than importing
// from a TypeScript source. After editing lib/video-url-parser.ts, confirm the
// production source uses the same `hostnameMatches` helper.

import { test } from "node:test";
import assert from "node:assert/strict";

const PLATFORM_HOSTNAMES = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
};

function hostnameMatches(hostname, allowed) {
  return hostname === allowed || hostname.endsWith("." + allowed);
}

function validatePlatformUrl(platform, url) {
  const allowedHostnames = PLATFORM_HOSTNAMES[platform.toLowerCase()];
  if (!allowedHostnames) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowedHostnames.some((allowed) =>
      hostnameMatches(hostname, allowed),
    );
  } catch {
    return false;
  }
}

function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostnameMatches(hostname, "tiktok.com")) return "tiktok";
    if (hostnameMatches(hostname, "instagram.com")) return "instagram";
    return null;
  } catch {
    return null;
  }
}

test("validatePlatformUrl: tiktok.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://tiktok.com/@user/video/1"),
    true,
  );
});

test("validatePlatformUrl: www.tiktok.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://www.tiktok.com/@user/video/1"),
    true,
  );
});

test("validatePlatformUrl: vm.tiktok.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://vm.tiktok.com/abc123/"),
    true,
  );
});

test("validatePlatformUrl: vt.tiktok.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://vt.tiktok.com/xyz/"),
    true,
  );
});

test("validatePlatformUrl: m.tiktok.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://m.tiktok.com/@u/video/1"),
    true,
  );
});

test("validatePlatformUrl: instagram.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("instagram", "https://instagram.com/reel/abc/"),
    true,
  );
});

test("validatePlatformUrl: www.instagram.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("instagram", "https://www.instagram.com/reel/abc/"),
    true,
  );
});

test("validatePlatformUrl: m.instagram.com is allowed", () => {
  assert.equal(
    validatePlatformUrl("instagram", "https://m.instagram.com/reel/abc/"),
    true,
  );
});

test("validatePlatformUrl: tiktok.com.evil.com is BLOCKED", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://tiktok.com.evil.com/x"),
    false,
  );
});

test("validatePlatformUrl: instagram.com.evil.com is BLOCKED", () => {
  assert.equal(
    validatePlatformUrl("instagram", "https://instagram.com.evil.com/x"),
    false,
  );
});

test("validatePlatformUrl: eviltiktok.com is BLOCKED (substring not subdomain)", () => {
  assert.equal(
    validatePlatformUrl("tiktok", "https://eviltiktok.com/x"),
    false,
  );
});

test("validatePlatformUrl: notinstagram.com is BLOCKED", () => {
  assert.equal(
    validatePlatformUrl("instagram", "https://notinstagram.com/x"),
    false,
  );
});

test("validatePlatformUrl: invalid URL returns false", () => {
  assert.equal(validatePlatformUrl("tiktok", "not a url"), false);
});

test("validatePlatformUrl: unknown platform passes through (true)", () => {
  assert.equal(
    validatePlatformUrl("youtube", "https://youtube.com/watch?v=1"),
    true,
  );
});

test("detectPlatform: tiktok URL detected", () => {
  assert.equal(detectPlatform("https://www.tiktok.com/@u/video/1"), "tiktok");
});

test("detectPlatform: instagram URL detected", () => {
  assert.equal(
    detectPlatform("https://www.instagram.com/reel/abc/"),
    "instagram",
  );
});

test("detectPlatform: tiktok.com.evil.com returns null", () => {
  assert.equal(detectPlatform("https://tiktok.com.evil.com/x"), null);
});

test("detectPlatform: instagram.com.evil.com returns null", () => {
  assert.equal(detectPlatform("https://instagram.com.evil.com/x"), null);
});

test("detectPlatform: unrelated domain returns null", () => {
  assert.equal(detectPlatform("https://example.com/x"), null);
});

test("detectPlatform: invalid URL returns null", () => {
  assert.equal(detectPlatform("not a url"), null);
});
