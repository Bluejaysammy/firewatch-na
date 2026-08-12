import { beforeAll, describe, expect, it } from "vitest";

// DATA_DIR is pointed at a unique temp directory in tests/setup.ts, which
// runs before these imports (an inline override here would be defeated by
// import hoisting and hit the real ./data database).
import { hashPassword, verifyPassword, USERNAME_RE } from "@/lib/server/auth";
import {
  createUser,
  checkCredentials,
  createSession,
  getSessionUser,
  SESSION_COOKIE,
} from "@/lib/server/auth";
import {
  createReport,
  listReports,
  addComment,
  listComments,
  flagReport,
  removeReport,
  reportSchema,
  canPostReport,
} from "@/lib/server/community";

function reqWithCookie(token: string): Request {
  return new Request("http://localhost/api/auth/me", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(stored).not.toContain("correct");
  });

  it("salts hashes (same password, different hash)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
});

describe("username rules", () => {
  it("accepts sane names and rejects junk", () => {
    expect(USERNAME_RE.test("sammy_2")).toBe(true);
    expect(USERNAME_RE.test("ab")).toBe(false);
    expect(USERNAME_RE.test("has space")).toBe(false);
    expect(USERNAME_RE.test("<script>")).toBe(false);
  });
});

describe("accounts, sessions, reports end-to-end", () => {
  let userId = 0;

  beforeAll(() => {
    const user = createUser("tester", "password123");
    expect(user).not.toBe("taken");
    if (user !== "taken") userId = user.id;
  });

  it("rejects duplicate usernames", () => {
    expect(createUser("tester", "password456")).toBe("taken");
  });

  it("authenticates only with correct credentials", () => {
    expect(checkCredentials("tester", "password123")?.username).toBe("tester");
    expect(checkCredentials("tester", "nope-nope-nope")).toBeNull();
    expect(checkCredentials("ghost", "password123")).toBeNull();
  });

  it("round-trips a session cookie and rejects garbage tokens", () => {
    const token = createSession(userId);
    expect(getSessionUser(reqWithCookie(token))?.username).toBe("tester");
    expect(getSessionUser(reqWithCookie("a".repeat(64)))).toBeNull();
    expect(getSessionUser(reqWithCookie("not-a-token"))).toBeNull();
  });

  it("validates report input strictly", () => {
    expect(reportSchema.safeParse({ kind: "smoke", body: "Smoke NE of lake", lat: 50, lon: -120 }).success).toBe(true);
    expect(reportSchema.safeParse({ kind: "lava", body: "x", lat: 50, lon: -120 }).success).toBe(false);
    expect(reportSchema.safeParse({ kind: "smoke", body: "ok text", lat: 95, lon: -120 }).success).toBe(false);
    expect(reportSchema.safeParse({ kind: "smoke", body: "", lat: 50, lon: -120 }).success).toBe(false);
  });

  it("creates, lists, comments, flags and removes reports", () => {
    const user = { id: userId, username: "tester" };
    const report = createReport(user, { kind: "smoke", body: "Grey column NE", lat: 50.1, lon: -120.2 }, null);
    expect(listReports().some((r) => r.id === report.id)).toBe(true);
    expect(canPostReport(userId)).toBe(true);

    addComment(user, report.id, "Seeing it too from the highway");
    expect(listComments(report.id)).toHaveLength(1);

    // three distinct users' flags auto-hide the report
    for (const name of ["flagger1", "flagger2", "flagger3"]) {
      const u = createUser(name, "password123");
      if (u !== "taken") flagReport(u.id, report.id);
    }
    expect(listReports().some((r) => r.id === report.id)).toBe(false);

    // owner can remove; stranger cannot
    const second = createReport(user, { kind: "note", body: "road is clear", lat: 50, lon: -120 }, null);
    const stranger = createUser("stranger", "password123");
    if (stranger !== "taken") {
      expect(removeReport({ id: stranger.id, role: "user" }, second.id)).toBe(false);
    }
    expect(removeReport({ id: userId, role: "user" }, second.id)).toBe(true);
    expect(listReports().some((r) => r.id === second.id)).toBe(false);
  });
});
