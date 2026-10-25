import * as THREE from "three";

/**
 * Module-level shared geometries. Components scale meshes instead of
 * allocating new geometry, so the whole office reuses a handful of buffers.
 * Unit-sized: scale a mesh to the dimensions you need.
 */

export const geoBox = new THREE.BoxGeometry(1, 1, 1);
export const geoCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
export const geoSphere = new THREE.SphereGeometry(0.5, 20, 16);
/** Hair-cap shells (radius 0.5, top cap down past the equator). */
export const geoHairCap = new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
export const geoHairCapAfro = new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
export const geoCapsule = new THREE.CapsuleGeometry(0.5, 1, 6, 12);
export const geoTorus = new THREE.TorusGeometry(0.5, 0.045, 10, 40);
export const geoOctahedron = new THREE.OctahedronGeometry(0.5);
export const geoCircle = new THREE.CircleGeometry(0.5, 40);
export const geoPlane = new THREE.PlaneGeometry(1, 1);
export const geoCone = new THREE.ConeGeometry(0.5, 1, 12);
