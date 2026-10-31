import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryBackend } from "@/lib/user/backend";
import { ProfileManager, scopedKey, PROFILES_KEY, ACTIVE_PROFILE_KEY } from "@/lib/user/manager";
import { initials, isProfileId, newProfileId } from "@/lib/user/profile";
import { viewsToApply } from "@/lib/user/view";

let n = 0;
const uuid = () => {
  n += 1;
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
};
const make = (b = new MemoryBackend()) => new ProfileManager(b, uuid);

describe("profile ids", () => {
  it("are usr_ plus a uuid", () => {
    expect(newProfileId()).toMatch(/^usr_[0-9a-f-]{36}$/);
    expect(isProfileId(newProfileId())).toBe(true);
    expect(isProfileId("usr_x")).toBe(false);
  });
  it("initials", () => {
    expect(initials("Mukund Kushwaha")).toBe("MK");
    expect(initials("you")).toBe("YO");
    expect(initials("  ")).toBe("?");
  });
});

describe("profile rules", () => {
  it("creates a first profile named You", () => {
    const m = make();
    expect(m.getState().profiles).toHaveLength(1);
    expect(m.getState().profiles[0]!.name).toBe("You");
    expect(m.getState().activeId).toBe(m.getState().profiles[0]!.id);
  });
  it("create, rename, switch", () => {
    const m = make();
    const first = m.getState().activeId!;
    const b = m.create("Asha");
    expect(m.getState().activeId).toBe(b.id);
    expect(m.rename(b.id, "  Asha  K ")).toBe(true);
    expect(m.getState().profiles.find((p) => p.id === b.id)!.name).toBe("Asha K");
    expect(m.rename(b.id, "   ")).toBe(false);
    expect(m.switchTo(first)).toBe(true);
    expect(m.getState().activeId).toBe(first);
    expect(m.switchTo("usr_nope")).toBe(false);
  });
  it("the last profile cannot be deleted; deleting the active one switches", () => {
    const m = make();
    const first = m.getState().activeId!;
    expect(m.remove(first)).toBe(false);
    const b = m.create("B");
    m.store.set("round", "x");
    expect(m.remove(b.id)).toBe(true);
    expect(m.getState().activeId).toBe(first);
    expect(m.getState().profiles).toHaveLength(1);
  });
  it("deleting a person deletes their settings", () => {
    const backend = new MemoryBackend();
    const m = make(backend);
    const b = m.create("B");
    m.store.set("round", "x");
    m.switchTo(m.getState().profiles[0]!.id);
    m.remove(b.id);
    expect(backend.getItem(scopedKey(b.id, "round"))).toBeNull();
  });
  it("persists across instances", () => {
    const backend = new MemoryBackend();
    const a = make(backend);
    const id = a.create("Z").id;
    expect(make(backend).getState().activeId).toBe(id);
  });
});

describe("namespacing", () => {
  it("two profiles do not see each other's values", () => {
    const m = make();
    const a = m.getState().activeId!;
    m.store.set("round", "A");
    m.store.set("practice.on", "true");
    const b = m.create("B");
    expect(m.store.get("round")).toBeNull();
    m.store.set("round", "B");
    expect(m.store.keys().sort()).toEqual(["round"]);
    m.switchTo(a);
    expect(m.store.get("round")).toBe("A");
    expect(m.store.keys().sort()).toEqual(["practice.on", "round"]);
    m.switchTo(b.id);
    expect(m.store.get("round")).toBe("B");
  });
  it("notifies subscribers on switch and on set", () => {
    const m = make();
    let calls = 0;
    m.subscribe(() => (calls += 1));
    m.create("B");
    m.store.set("k", "v");
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe("legacy migration", () => {
  const legacy = () => {
    const b = new MemoryBackend();
    b.setItem("atlas.round", '{"raise":2000000,"inst":"post_money_safe"}');
    b.setItem("atlas.practice.on", "true");
    b.setItem("atlas.practice.scenarios", "[]");
    b.setItem("atlas.strategy.tierOverrides", '{"inv_a":"A"}');
    b.setItem("atlas.directory.density", "compact");
    b.setItem("atlas.directory.columns", '["name"]');
    b.setItem("atlas-theme", "dark");
    b.setItem("atlas-ui", '{"state":{"railCollapsed":true},"version":0}');
    b.setItem("atlas-inspector", '{"state":{"width":500},"version":0}');
    return b;
  };
  it("moves every atlas key into the first profile and is idempotent", () => {
    const b = legacy();
    const m = make(b);
    expect(m.store.get("round")).toContain("2000000");
    expect(m.store.get("practice.on")).toBe("true");
    expect(m.store.get("strategy.tierOverrides")).toContain("inv_a");
    expect(m.store.get("directory.density")).toBe("compact");
    expect(m.store.get("theme")).toBe("dark");
    expect(m.store.get("ui")).toContain("railCollapsed");
    expect(m.store.get("inspector")).toContain("500");
    expect(b.keys().filter((k) => k.startsWith("atlas"))).toEqual([]);
    const snapshot = JSON.stringify(b.keys().sort().map((k) => [k, b.getItem(k)]));
    const again = make(b);
    again.refresh();
    expect(JSON.stringify(b.keys().sort().map((k) => [k, b.getItem(k)]))).toBe(snapshot);
    expect(b.getItem(PROFILES_KEY)).toBeTruthy();
    expect(b.getItem(ACTIVE_PROFILE_KEY)).toBe(m.getState().activeId);
  });
  it("a second person does not inherit legacy values", () => {
    const m = make(legacy());
    m.create("B");
    expect(m.store.get("round")).toBeNull();
  });
});

describe("URL versus profile", () => {
  const stored = { round: "raise=2000000", weights: "40,20,10,10,10,10", filters: "region=india" };
  it("fills only groups the URL lacks", () => {
    const out = viewsToApply(new URLSearchParams("w=30,20,15,15,10,10"), stored);
    expect(out.weights).toBeUndefined();
    expect(out.round).toBe(stored.round);
    expect(out.filters).toBe(stored.filters);
  });
  it("a URL with filters or a round wins for that group", () => {
    const out = viewsToApply(new URLSearchParams("region=western&raise=1500000"), stored);
    expect(out).toEqual({ weights: stored.weights });
  });
  it("nothing stored, nothing applied; after a switch the URL is ignored and defaults fill gaps", () => {
    expect(viewsToApply(new URLSearchParams(""), {})).toEqual({});
    const out = viewsToApply(new URLSearchParams("w=1"), { round: "raise=5" }, { ignoreUrl: true });
    expect(out).toEqual({ round: "raise=5", weights: "", filters: "" });
  });
});

describe("no direct storage use", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("only src/lib/user touches localStorage or sessionStorage", () => {
    const root = join(process.cwd(), "src");
    const bad = walk(root)
      .filter((p) => !relative(root, p).replace(/\\/g, "/").startsWith("lib/user/"))
      .filter((p) => /\b(local|session)Storage\b/.test(strip(readFileSync(p, "utf8"))))
      .map((p) => relative(root, p));
    expect(bad).toEqual([]);
  });
  it("persisted zustand stores name a storage", () => {
    const root = join(process.cwd(), "src");
    const bad = walk(root).filter((p) => {
      const s = readFileSync(p, "utf8");
      return s.includes("persist(") && !s.includes("storage:");
    });
    expect(bad).toEqual([]);
  });
});
