import * as THREE from "three";
import { TARGET_RADIUS } from "../game/scoring";
import type { WeaponId } from "../game/types";

export interface TargetRig {
  group: THREE.Group;
  surface: THREE.Mesh;
  farZ: number;
  nearZ: number;
  addBulletHole: (x: number, y: number, ring: number) => void;
  clearBulletHoles: () => void;
}

export interface RangeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: THREE.Object3D;
  target: TargetRig;
  npcAnchor: THREE.Object3D;
  setWeaponModel: (weapon: WeaponId) => void;
  showMuzzleFlash: (weapon: WeaponId) => void;
  updateEffects: (deltaSeconds: number) => void;
}

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: "#34383b", roughness: 0.86, metalness: 0.08 }),
  wall: new THREE.MeshStandardMaterial({ color: "#4e5357", roughness: 0.9, metalness: 0.04 }),
  divider: new THREE.MeshStandardMaterial({ color: "#2a3130", roughness: 0.78, metalness: 0.14 }),
  lane: new THREE.MeshStandardMaterial({ color: "#b98f46", roughness: 0.72, metalness: 0.02 }),
  rail: new THREE.MeshStandardMaterial({ color: "#7b858c", roughness: 0.34, metalness: 0.54 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#101214", roughness: 0.76, metalness: 0.02 }),
  weapon: new THREE.MeshStandardMaterial({ color: "#1d2327", roughness: 0.5, metalness: 0.42 }),
  weaponGrip: new THREE.MeshStandardMaterial({ color: "#202b26", roughness: 0.78, metalness: 0.12 }),
  accent: new THREE.MeshStandardMaterial({ color: "#d6b76f", roughness: 0.42, metalness: 0.2 }),
  npcCloth: new THREE.MeshStandardMaterial({ color: "#2e4d49", roughness: 0.82, metalness: 0.03 }),
  npcSkin: new THREE.MeshStandardMaterial({ color: "#bf9476", roughness: 0.72, metalness: 0.0 }),
};

export function createRangeScene(canvasRoot: HTMLElement): RangeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#161b1f");
  scene.fog = new THREE.Fog("#161b1f", 14, 46);

  const player = new THREE.Object3D();
  player.position.set(0, 1.62, 3.35);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 90);
  camera.rotation.order = "YXZ";
  player.add(camera);
  scene.add(player);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasRoot.appendChild(renderer.domElement);

  buildRange(scene);
  const target = createTargetRig(scene);
  const npcAnchor = createNpc(scene);
  const weaponRig = createWeaponRig(camera);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene,
    camera,
    renderer,
    player,
    target,
    npcAnchor,
    setWeaponModel: weaponRig.setWeaponModel,
    showMuzzleFlash: weaponRig.showMuzzleFlash,
    updateEffects: weaponRig.updateEffects,
  };
}

function buildRange(scene: THREE.Scene): void {
  const ambient = new THREE.HemisphereLight("#d7e7ff", "#242423", 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight("#ffffff", 1.65);
  keyLight.position.set(4.5, 8, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 52;
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  scene.add(keyLight);

  const stripLight = new THREE.PointLight("#e8f4ff", 2.8, 22, 1.6);
  stripLight.position.set(0, 4.1, -9);
  scene.add(stripLight);

  addBox(scene, [8.8, 0.18, 34], [0, -0.12, -12], materials.floor, true, false);
  addBox(scene, [9.4, 4.8, 0.42], [0, 2.2, -29.2], materials.rubber, true, true);
  addBox(scene, [0.24, 4.2, 34], [-4.55, 1.95, -12], materials.wall, true, false);
  addBox(scene, [0.24, 4.2, 34], [4.55, 1.95, -12], materials.wall, true, false);
  addBox(scene, [9.2, 0.22, 34], [0, 4.12, -12], materials.wall, false, false);

  for (let z = 1.6; z > -25; z -= 4.4) {
    addBox(scene, [8.6, 0.03, 0.06], [0, 0.01, z], materials.rail, false, true);
  }

  addBox(scene, [0.08, 0.08, 29], [-1.38, 0.08, -12.4], materials.rail, false, true);
  addBox(scene, [0.08, 0.08, 29], [1.38, 0.08, -12.4], materials.rail, false, true);
  addBox(scene, [3.05, 0.07, 3.2], [0, 0.02, 2.1], materials.lane, true, false);
  addBox(scene, [3.3, 1.3, 0.16], [0, 0.68, 4.05], materials.divider, true, false);
  addBox(scene, [0.16, 1.7, 4.1], [-1.8, 0.82, 2.2], materials.divider, true, false);
  addBox(scene, [0.16, 1.7, 4.1], [1.8, 0.82, 2.2], materials.divider, true, false);

  for (const x of [-3.15, 3.15]) {
    addBox(scene, [0.18, 2.6, 25], [x, 1.32, -10.5], materials.divider, true, false);
  }

  for (const z of [-3, -9, -15, -21]) {
    const light = new THREE.PointLight("#fff0d0", 1.6, 8.5, 1.8);
    light.position.set(-3.9, 3.55, z);
    scene.add(light);

    const lightBox = addBox(scene, [0.55, 0.07, 0.32], [-3.9, 4.02, z], materials.accent, false, false);
    lightBox.name = "warm-ceiling-strip";
  }
}

function createTargetRig(scene: THREE.Scene): TargetRig {
  const group = new THREE.Group();
  group.name = "motorized-target";
  group.position.set(0, 1.82, -22);
  scene.add(group);

  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(TARGET_RADIUS * 2.18, TARGET_RADIUS * 2.18, 0.08),
    new THREE.MeshStandardMaterial({ color: "#e5dfcd", roughness: 0.84, metalness: 0.02 }),
  );
  backing.position.z = -0.045;
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const ringColors = ["#f1eee3", "#17191b", "#2f6f9f", "#b8352c", "#d9b946"];
  const radii = [TARGET_RADIUS, TARGET_RADIUS * 0.8, TARGET_RADIUS * 0.6, TARGET_RADIUS * 0.4, TARGET_RADIUS * 0.2];
  radii.forEach((radius, index) => {
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 96),
      new THREE.MeshStandardMaterial({
        color: ringColors[index],
        roughness: 0.65,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    );
    disk.position.z = index * 0.006;
    disk.castShadow = true;
    disk.receiveShadow = true;
    group.add(disk);
  });

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(TARGET_RADIUS * 2.12, TARGET_RADIUS * 2.12),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  surface.name = "target-hit-surface";
  surface.position.z = 0.045;
  surface.userData.targetSurface = true;
  group.add(surface);

  const hanger = addBox(group, [0.14, 0.9, 0.12], [0, TARGET_RADIUS + 0.48, -0.02], materials.rail, true, true);
  hanger.name = "target-hanger";
  addBox(group, [2.2, 0.06, 0.08], [0, TARGET_RADIUS + 0.92, -0.02], materials.rail, true, true);

  const holes = new THREE.Group();
  holes.name = "bullet-holes";
  group.add(holes);

  const holeMaterial = new THREE.MeshBasicMaterial({
    color: "#0a0b0c",
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return {
    group,
    surface,
    farZ: -22,
    nearZ: -5.2,
    addBulletHole: (x, y, ring) => {
      const radius = ring >= 9 ? 0.024 : 0.031;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), holeMaterial);
      hole.position.set(x, y, 0.07 + holes.children.length * 0.0008);
      hole.name = "bullet-hole";
      holes.add(hole);

      if (holes.children.length > 90) {
        const oldest = holes.children[0];
        holes.remove(oldest);
      }
    },
    clearBulletHoles: () => {
      holes.clear();
    },
  };
}

function createNpc(scene: THREE.Scene): THREE.Object3D {
  const npc = new THREE.Group();
  npc.name = "npc-range-trainer";
  npc.position.set(-1.32, 0, 1.85);
  npc.rotation.y = 0.22;
  scene.add(npc);

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.28), materials.divider);
  legs.position.y = 0.42;
  legs.castShadow = true;
  npc.add(legs);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.78, 8, 16), materials.npcCloth);
  body.position.y = 1.2;
  body.castShadow = true;
  npc.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), materials.npcSkin);
  head.position.y = 1.92;
  head.castShadow = true;
  npc.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.08), materials.rubber);
  visor.position.set(0, 1.94, 0.2);
  visor.castShadow = true;
  npc.add(visor);

  const armLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.58, 8, 12), materials.npcCloth);
  armLeft.position.set(-0.36, 1.26, 0.03);
  armLeft.rotation.z = -0.25;
  npc.add(armLeft);

  const armRight = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.58, 8, 12), materials.npcCloth);
  armRight.position.set(0.36, 1.24, 0.04);
  armRight.rotation.z = 0.34;
  npc.add(armRight);

  const anchor = new THREE.Object3D();
  anchor.name = "npc-bubble-anchor";
  anchor.position.set(0, 2.42, 0.05);
  npc.add(anchor);

  return anchor;
}

function createWeaponRig(camera: THREE.Camera): {
  setWeaponModel: (weapon: WeaponId) => void;
  showMuzzleFlash: (weapon: WeaponId) => void;
  updateEffects: (deltaSeconds: number) => void;
} {
  const mount = new THREE.Group();
  mount.name = "first-person-weapon";
  mount.position.set(0.45, -0.34, -0.74);
  mount.rotation.set(-0.045, -0.12, 0.03);
  camera.add(mount);

  const pistol = new THREE.Group();
  pistol.name = "pistol-model";
  pistol.add(makeWeaponBox([0.22, 0.18, 0.48], [0, 0.02, -0.14], materials.weapon));
  pistol.add(makeWeaponBox([0.16, 0.36, 0.18], [0, -0.22, 0.04], materials.weaponGrip));
  pistol.add(makeWeaponBox([0.13, 0.12, 0.52], [0, 0.12, -0.48], materials.weapon));
  pistol.add(makeWeaponBox([0.09, 0.09, 0.08], [0, 0.12, -0.78], materials.rubber));
  mount.add(pistol);

  const assault = new THREE.Group();
  assault.name = "assault-model";
  assault.add(makeWeaponBox([0.28, 0.19, 0.9], [0, 0.02, -0.34], materials.weapon));
  assault.add(makeWeaponBox([0.16, 0.42, 0.2], [0, -0.28, -0.12], materials.weaponGrip));
  assault.add(makeWeaponBox([0.13, 0.12, 0.9], [0, 0.08, -0.95], materials.weapon));
  assault.add(makeWeaponBox([0.34, 0.12, 0.32], [0, 0.23, -0.22], materials.rubber));
  assault.add(makeWeaponBox([0.09, 0.09, 0.1], [0, 0.08, -1.45], materials.rubber));
  assault.visible = false;
  mount.add(assault);

  const flash = new THREE.Group();
  flash.name = "muzzle-flash";
  const flashMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.42, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: "#ffd06b", transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  );
  flashMesh.rotation.x = Math.PI / 2;
  flash.add(flashMesh);
  const flashLight = new THREE.PointLight("#ffc266", 2.4, 2.5);
  flash.add(flashLight);
  flash.visible = false;
  mount.add(flash);

  let flashTimer = 0;
  let kickTimer = 0;
  const basePosition = mount.position.clone();
  const setWeaponModel = (weapon: WeaponId) => {
    pistol.visible = weapon === "pistol";
    assault.visible = weapon === "assault";
    flash.position.set(0, weapon === "pistol" ? 0.12 : 0.08, weapon === "pistol" ? -0.84 : -1.48);
  };

  setWeaponModel("pistol");

  return {
    setWeaponModel,
    showMuzzleFlash: (weapon) => {
      setWeaponModel(weapon);
      flash.visible = true;
      flashTimer = weapon === "pistol" ? 0.055 : 0.035;
      kickTimer = weapon === "pistol" ? 0.075 : 0.045;
      mount.position.z = basePosition.z + (weapon === "pistol" ? 0.055 : 0.035);
    },
    updateEffects: (deltaSeconds) => {
      if (flashTimer > 0) {
        flashTimer -= deltaSeconds;
        flash.visible = flashTimer > 0;
      }

      if (kickTimer > 0) {
        kickTimer -= deltaSeconds;
        const t = Math.max(kickTimer, 0) / 0.075;
        mount.position.lerpVectors(basePosition, new THREE.Vector3(basePosition.x, basePosition.y, basePosition.z + 0.06), t);
      } else {
        mount.position.copy(basePosition);
      }
    },
  };
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  receiveShadow: boolean,
  castShadow: boolean,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = castShadow;
  parent.add(mesh);
  return mesh;
}

function makeWeaponBox(size: [number, number, number], position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
