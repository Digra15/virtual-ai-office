import { describe, expect, it } from "vitest";
import { OFFICE_CONFIG_SCHEMAS } from "@virtual-ai-office/shared";
import { validateAssetFile } from "./pages/AssetsPage";

describe("OFFICE_CONFIG_SCHEMAS (client-side validation mirrors the Worker)", () => {
  it("office.theme accepts a preset and rejects others", () => {
    expect(OFFICE_CONFIG_SCHEMAS["office.theme"].safeParse("midnight").success).toBe(
      true,
    );
    expect(
      OFFICE_CONFIG_SCHEMAS["office.theme"].safeParse("neon").success,
    ).toBe(false);
  });

  it("office.camera validates position/target tuples and fov range", () => {
    const ok = OFFICE_CONFIG_SCHEMAS["office.camera"].safeParse({
      position: [16, 13, 16],
      target: [0, 0, 0],
      fov: 45,
    });
    expect(ok.success).toBe(true);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.camera"].safeParse({
        position: [16, 13],
        target: [0, 0, 0],
        fov: 45,
      }).success,
    ).toBe(false);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.camera"].safeParse({
        position: [16, 13, 16],
        target: [0, 0, 0],
        fov: 10,
      }).success,
    ).toBe(false);
  });

  it("office.rooms validates room entries", () => {
    expect(
      OFFICE_CONFIG_SCHEMAS["office.rooms"].safeParse([
        { id: "lounge", name: "Lounge", visible: true },
      ]).success,
    ).toBe(true);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.rooms"].safeParse([
        { id: "", name: "x" },
      ]).success,
    ).toBe(false);
  });

  it("office.workstations validates [x, z] positions", () => {
    expect(
      OFFICE_CONFIG_SCHEMAS["office.workstations"].safeParse([
        { id: "ws-01", position: [4, -2], rotationY: 0, label: "A", enabled: true },
      ]).success,
    ).toBe(true);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.workstations"].safeParse([
        { id: "ws-01", position: [4], rotationY: 0 },
      ]).success,
    ).toBe(false);
  });

  it("office.assignments is a workerId -> workstationId record", () => {
    expect(
      OFFICE_CONFIG_SCHEMAS["office.assignments"].safeParse({
        nika: "ws-01",
      }).success,
    ).toBe(true);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.assignments"].safeParse(["nika"]).success,
    ).toBe(false);
  });

  it("office.visibility has boolean flags", () => {
    expect(
      OFFICE_CONFIG_SCHEMAS["office.visibility"].safeParse({
        publicScene: true,
        showOffline: false,
      }).success,
    ).toBe(true);
  });

  it("office.branding requires a non-empty office name", () => {
    expect(
      OFFICE_CONFIG_SCHEMAS["office.branding"].safeParse({
        officeName: "",
      }).success,
    ).toBe(false);
    expect(
      OFFICE_CONFIG_SCHEMAS["office.branding"].safeParse({
        officeName: "Acme AI",
        primaryColor: "#ff0000",
        accentColor: "#00ff00",
      }).success,
    ).toBe(true);
  });
});

describe("asset upload client-side validation (mirrors ASSET_UPLOAD_LIMITS)", () => {
  const file = (name: string, size: number) =>
    new File(["x".repeat(Math.min(size, 10))], name, {
      type: "model/gltf-binary",
    });

  it("accepts a small .glb", () => {
    const f = file("model.glb", 1024);
    Object.defineProperty(f, "size", { value: 1024 });
    expect(validateAssetFile(f)).toBeNull();
  });

  it("rejects files over 25 MB", () => {
    const f = file("big.glb", 10);
    Object.defineProperty(f, "size", { value: 26 * 1024 * 1024 });
    expect(validateAssetFile(f)).toContain("25 MB");
  });

  it("rejects disallowed extensions", () => {
    const f = file("model.obj", 1024);
    Object.defineProperty(f, "size", { value: 1024 });
    expect(validateAssetFile(f)).toContain(".glb");
  });
});
