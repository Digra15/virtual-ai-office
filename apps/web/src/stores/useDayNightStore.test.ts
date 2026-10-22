import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveIsNight,
  resolveIsNightAt,
  useDayNightStore,
} from "./useDayNightStore";

const KEY = "vao-daynight-mode";

function atHour(h: number): Date {
  const d = new Date(2026, 9, 22, h, 0, 0, 0); // local time
  expect(d.getHours()).toBe(h);
  return d;
}

beforeEach(() => {
  window.localStorage.removeItem(KEY);
  useDayNightStore.setState({
    mode: "auto",
    isNight: resolveIsNightAt("auto", atHour(12)),
  });
});

describe("resolveIsNight (pure, local hour)", () => {
  it("auto follows the 06:00–18:00 day window", () => {
    expect(resolveIsNight("auto", 5)).toBe(true);
    expect(resolveIsNight("auto", 5.999)).toBe(true);
    expect(resolveIsNight("auto", 6)).toBe(false);
    expect(resolveIsNight("auto", 17.999)).toBe(false);
    expect(resolveIsNight("auto", 18)).toBe(true);
    expect(resolveIsNight("auto", 0)).toBe(true);
    expect(resolveIsNight("auto", 23)).toBe(true);
  });

  it("manual modes ignore the clock", () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      expect(resolveIsNight("day", hour), `day@${hour}`).toBe(false);
      expect(resolveIsNight("night", hour), `night@${hour}`).toBe(true);
    }
  });
});

describe("resolveIsNightAt (pure, Date)", () => {
  it("hits the exact boundaries", () => {
    expect(resolveIsNightAt("auto", atHour(5))).toBe(true);
    // 05:59 is still night, 06:00 is day
    const pre = new Date(2026, 9, 22, 5, 59);
    expect(resolveIsNightAt("auto", pre)).toBe(true);
    expect(resolveIsNightAt("auto", atHour(6))).toBe(false);
    // 17:59 is day, 18:00 is night
    const evening = new Date(2026, 9, 22, 17, 59);
    expect(resolveIsNightAt("auto", evening)).toBe(false);
    expect(resolveIsNightAt("auto", atHour(18))).toBe(true);
  });

  it("manual modes ignore the clock", () => {
    expect(resolveIsNightAt("day", atHour(3))).toBe(false);
    expect(resolveIsNightAt("night", atHour(14))).toBe(true);
  });
});

describe("useDayNightStore", () => {
  it("setMode persists to localStorage", () => {
    useDayNightStore.getState().setMode("night");
    expect(window.localStorage.getItem(KEY)).toBe("night");
    expect(useDayNightStore.getState().mode).toBe("night");
    expect(useDayNightStore.getState().isNight).toBe(true);

    useDayNightStore.getState().setMode("day");
    expect(window.localStorage.getItem(KEY)).toBe("day");
    expect(useDayNightStore.getState().isNight).toBe(false);
  });

  it("reResolve recomputes isNight from the current mode", () => {
    const s = useDayNightStore.getState();
    s.setMode("auto");
    useDayNightStore.getState().reResolve(atHour(21));
    expect(useDayNightStore.getState().isNight).toBe(true);
    useDayNightStore.getState().reResolve(atHour(10));
    expect(useDayNightStore.getState().isNight).toBe(false);
    // manual mode wins over the clock
    useDayNightStore.getState().setMode("night");
    useDayNightStore.getState().reResolve(atHour(10));
    expect(useDayNightStore.getState().isNight).toBe(true);
  });
});
