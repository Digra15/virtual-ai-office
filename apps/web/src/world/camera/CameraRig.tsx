import { memo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useCameraStore } from "../../stores/useCameraStore";

const DEFAULT_POS = new THREE.Vector3(16, 13, 16);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const TWEEN_SECONDS = 1;

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
 * camera to a viewpoint near the agent; reset glides back to the default.
 * Any manual drag cancels the in-flight tween. Touch works via
 * OrbitControls defaults.
 */
export const CameraRig = memo(function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const tween = useRef<Tween | null>(null);
  const seenFocus = useRef(0);
  const seenReset = useRef(0);

  // React to store requests (outside useFrame — no per-frame store reads).
  useEffect(() => {
    const unsub = useCameraStore.subscribe((s) => {
      const controls = controlsRef.current;
      const req = s.focusRequest;
      if (req && req.nonce !== seenFocus.current) {
        seenFocus.current = req.nonce;
        if (!controls) return;
        const toTarget = new THREE.Vector3(req.position[0], 1.1, req.position[2]);
        const toPos = toTarget.clone().add(new THREE.Vector3(4.5, 4.2, 6));
        tween.current = {
          t: 0,
          fromPos: controls.object.position.clone(),
          toPos,
          fromTarget: controls.target.clone(),
          toTarget,
        };
      }
      if (s.resetNonce !== seenReset.current) {
        seenReset.current = s.resetNonce;
        if (!controls) return;
        tween.current = {
          t: 0,
          fromPos: controls.object.position.clone(),
          toPos: DEFAULT_POS.clone(),
          fromTarget: controls.target.clone(),
          toTarget: DEFAULT_TARGET.clone(),
        };
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
      minDistance={4}
      maxDistance={40}
      maxPolarAngle={1.45}
      target={[0, 0, 0]}
    />
  );
});
