import { memo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useCameraStore } from "../../stores/useCameraStore";
import { useBuildingViewStore } from "../../stores/useBuildingViewStore";
import { CAMERA_PRESETS, ROOM_BY_ID } from "../building/floorPlan";

const DEFAULT_POS = new THREE.Vector3(18, 13, 22);
const DEFAULT_TARGET = new THREE.Vector3(0, 1, -1);
const TWEEN_SECONDS = 1.2;
/** Camera offset added to a room anchor for "navigate to room". */
const ROOM_OFFSET = new THREE.Vector3(10, 9, 12);
const FOCUS_OFFSET = new THREE.Vector3(4.5, 4.2, 6);

interface Tween {
  t: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/**
 * OrbitControls plus store-driven camera tweens. Focus requests glide the
 * camera to a viewpoint near the agent; reset glides back to the default;
 * floor-view changes glide to the matching CAMERA_PRESETS entry; room
 * requests glide to the room's anchor. Any manual drag cancels the
 * in-flight tween. Touch works via OrbitControls defaults.
 */
export const CameraRig = memo(function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const tween = useRef<Tween | null>(null);
  const seenFocus = useRef(0);
  const seenReset = useRef(0);
  const seenView = useRef(0);
  const seenRoom = useRef(0);

  const tweenTo = (toPos: THREE.Vector3, toTarget: THREE.Vector3) => {
    const controls = controlsRef.current;
    if (!controls) return;
    tween.current = {
      t: 0,
      fromPos: controls.object.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget,
    };
  };

  const tweenToFloorPreset = () => {
    const preset =
      CAMERA_PRESETS[useBuildingViewStore.getState().floorMode];
    tweenTo(
      new THREE.Vector3(...preset.position),
      new THREE.Vector3(...preset.target),
    );
  };

  // React to store requests (outside useFrame — no per-frame store reads).
  useEffect(() => {
    // Glide to the active floor preset on mount.
    tweenToFloorPreset();
    const unsub = useCameraStore.subscribe((s) => {
      const req = s.focusRequest;
      if (req && req.nonce !== seenFocus.current) {
        seenFocus.current = req.nonce;
        const toTarget = new THREE.Vector3(req.position[0], 1.1, req.position[2]);
        tweenTo(toTarget.clone().add(FOCUS_OFFSET), toTarget);
      }
      if (s.viewNonce !== seenView.current) {
        seenView.current = s.viewNonce;
        tweenToFloorPreset();
      }
      const roomReq = s.roomRequest;
      if (roomReq && roomReq.nonce !== seenRoom.current) {
        seenRoom.current = roomReq.nonce;
        const room = ROOM_BY_ID[roomReq.roomId];
        if (room) {
          const toTarget = new THREE.Vector3(...room.anchor);
          tweenTo(toTarget.clone().add(ROOM_OFFSET), toTarget);
        }
      }
      if (s.resetNonce !== seenReset.current) {
        seenReset.current = s.resetNonce;
        tweenTo(DEFAULT_POS.clone(), DEFAULT_TARGET.clone());
      }
    });
    return unsub;
  }, []);

  // Manual interaction cancels the tween.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cancel = () => {
      tween.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, []);

  useFrame((state, delta) => {
    const tw = tween.current;
    const controls = controlsRef.current;
    if (!tw || !controls) return;
    tw.t = Math.min(1, tw.t + delta / TWEEN_SECONDS);
    const k = easeInOut(tw.t);
    state.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
    if (tw.t >= 1) tween.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={70}
      maxPolarAngle={1.5}
      target={[0, 0, 0]}
    />
  );
});
