import * as THREE from "three";

/**
 * Module-level shared materials. Every mesh in the office reuses these
 * instances — no per-mesh material allocation for static furniture.
 *
 * RULE: shared materials are never mutated at runtime. Anything that needs a
 * per-instance color (agent bodies, monitor screens, status rings, rack LEDs)
 * creates its own material inside the component (usually via useMemo).
 */

export const matDeskTop = new THREE.MeshStandardMaterial({
  color: "#2b3542",
  roughness: 0.55,
  metalness: 0.25,
});

export const matDeskLeg = new THREE.MeshStandardMaterial({
  color: "#141a24",
  roughness: 0.4,
  metalness: 0.7,
});

export const matChairSeat = new THREE.MeshStandardMaterial({
  color: "#334155",
  roughness: 0.85,
});

export const matChairFrame = new THREE.MeshStandardMaterial({
  color: "#1a2230",
  roughness: 0.45,
  metalness: 0.6,
});

export const matMonitorFrame = new THREE.MeshStandardMaterial({
  color: "#0b1220",
  roughness: 0.5,
  metalness: 0.3,
});

export const matMonitorStand = new THREE.MeshStandardMaterial({
  color: "#1e293b",
  roughness: 0.5,
  metalness: 0.5,
});

export const matWall = new THREE.MeshStandardMaterial({
  color: "#161e2e",
  roughness: 0.95,
});

export const matWallTrim = new THREE.MeshStandardMaterial({
  color: "#0d1422",
  roughness: 0.9,
});

export const matGlass = new THREE.MeshStandardMaterial({
  color: "#7dd3fc",
  transparent: true,
  opacity: 0.16,
  roughness: 0.08,
  metalness: 0.2,
  side: THREE.DoubleSide,
});

export const matFloor = new THREE.MeshStandardMaterial({
  color: "#0d1322",
  roughness: 0.9,
  metalness: 0.05,
});

export const matPlantLeaf = new THREE.MeshStandardMaterial({
  color: "#15803d",
  roughness: 0.9,
});

export const matPlantLeaf2 = new THREE.MeshStandardMaterial({
  color: "#16a34a",
  roughness: 0.9,
});

export const matPlantPot = new THREE.MeshStandardMaterial({
  color: "#7c4a21",
  roughness: 0.9,
});

export const matSofa = new THREE.MeshStandardMaterial({
  color: "#3b3350",
  roughness: 0.95,
});

export const matSofaCushion = new THREE.MeshStandardMaterial({
  color: "#4a4166",
  roughness: 0.95,
});

export const matRug = new THREE.MeshStandardMaterial({
  color: "#1c2942",
  roughness: 1,
});

export const matRugAccent = new THREE.MeshStandardMaterial({
  color: "#27395c",
  roughness: 1,
});

export const matRack = new THREE.MeshStandardMaterial({
  color: "#101724",
  roughness: 0.45,
  metalness: 0.65,
});

export const matRackPanel = new THREE.MeshStandardMaterial({
  color: "#05080f",
  roughness: 0.6,
  metalness: 0.4,
});

/** Base LED material — cloned per ServerRack so blink phases stay independent. */
export const matLedBase = new THREE.MeshStandardMaterial({
  color: "#052e16",
  emissive: new THREE.Color("#22c55e"),
  emissiveIntensity: 1.2,
  roughness: 0.4,
});

export const matWhiteboard = new THREE.MeshStandardMaterial({
  color: "#e8eef7",
  roughness: 0.25,
});

export const matWhiteboardFrame = new THREE.MeshStandardMaterial({
  color: "#94a3b8",
  roughness: 0.4,
  metalness: 0.7,
});

export const matMeetingTop = new THREE.MeshStandardMaterial({
  color: "#31405c",
  roughness: 0.5,
  metalness: 0.2,
});

export const matShelf = new THREE.MeshStandardMaterial({
  color: "#3a2c1e",
  roughness: 0.8,
});

export const matSkin = new THREE.MeshStandardMaterial({
  color: "#e0aa7e",
  roughness: 0.7,
});

export const matEye = new THREE.MeshStandardMaterial({
  color: "#0b0f1a",
  roughness: 0.3,
});

export const matPartition = new THREE.MeshStandardMaterial({
  color: "#22304a",
  roughness: 0.9,
});

export const matLampShade = new THREE.MeshStandardMaterial({
  color: "#1a2438",
  roughness: 0.6,
  side: THREE.DoubleSide,
});

export const matLampGlow = new THREE.MeshStandardMaterial({
  color: "#111827",
  emissive: new THREE.Color("#fde68a"),
  emissiveIntensity: 1.6,
  roughness: 0.5,
});

export const matBookRed = new THREE.MeshStandardMaterial({ color: "#7f1d1d", roughness: 0.8 });
export const matBookBlue = new THREE.MeshStandardMaterial({ color: "#1e40af", roughness: 0.8 });
export const matBookGreen = new THREE.MeshStandardMaterial({ color: "#166534", roughness: 0.8 });
export const matBookAmber = new THREE.MeshStandardMaterial({ color: "#92400e", roughness: 0.8 });

// ---------------------------------------------------------------------------
// Chibi character shared materials (color-neutral parts). Per-character
// (legacy note) per-character colors now come from the pixel sprite palette.
// ---------------------------------------------------------------------------

/** Sclera — bright white, slightly glossy. */
export const matChibiEyeWhite = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.15,
});

/** Eye highlight dot. */
export const matChibiWhite = new THREE.MeshStandardMaterial({
  color: "#f8fafc",
  roughness: 0.2,
  emissive: new THREE.Color("#ffffff"),
  emissiveIntensity: 0.35,
});

/** Small cute mouth. */
export const matChibiMouth = new THREE.MeshStandardMaterial({
  color: "#8a4a5a",
  roughness: 0.6,
});

/** Blush marks — soft pink, semi-transparent. */
export const matChibiBlush = new THREE.MeshStandardMaterial({
  color: "#f9a8d4",
  transparent: true,
  opacity: 0.55,
  roughness: 0.9,
});

/** Dark neutral: glasses frames, headphone bands, mic booms. */
export const matChibiDark = new THREE.MeshStandardMaterial({
  color: "#1f2937",
  roughness: 0.5,
});

/** Accessory red: ribbons, ties, mic tips. */
export const matChibiRed = new THREE.MeshStandardMaterial({
  color: "#e11d48",
  roughness: 0.6,
});

/** Accessory gold: star pins. */
export const matChibiGold = new THREE.MeshStandardMaterial({
  color: "#fbbf24",
  emissive: new THREE.Color("#fbbf24"),
  emissiveIntensity: 0.3,
  roughness: 0.4,
});

/** Shoes. */
export const matChibiShoe = new THREE.MeshStandardMaterial({
  color: "#1f2937",
  roughness: 0.7,
});

/** Neckties. */
export const matChibiTie = new THREE.MeshStandardMaterial({
  color: "#991b1b",
  roughness: 0.7,
});
