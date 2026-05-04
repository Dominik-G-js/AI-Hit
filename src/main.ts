import "./style.css";
import * as THREE from "three";
import { GunAudio } from "./audio/gunAudio";
import { buildLocalCommentary, calculateRing, summarizeRound, TARGET_RADIUS } from "./game/scoring";
import type { NpcCommentaryResponse, RoundStats, ShotRecord, TargetMode, WeaponId } from "./game/types";
import { getWeapon } from "./game/weapons";
import { createRangeScene, type RangeScene } from "./render/createRangeScene";
import { Hud } from "./ui/hud";

const canvasRoot = document.getElementById("canvas-root");
if (!canvasRoot) {
  throw new Error("Missing #canvas-root");
}

class ShootingRangeGame {
  private readonly range: RangeScene;
  private readonly hud = new Hud();
  private readonly audio = new GunAudio();
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pressedKeys = new Set<string>();
  private readonly shotOrigin = new THREE.Vector3();
  private readonly shotDirection = new THREE.Vector3();
  private readonly cameraQuaternion = new THREE.Quaternion();

  private weaponId: WeaponId = "pistol";
  private ammo = getWeapon("pistol").magazineSize;
  private shots: ShotRecord[] = [];
  private roundStartedAtMs = performance.now();
  private targetMode: TargetMode = "ready";
  private pointerLocked = false;
  private mouseDown = false;
  private roundCompleted = false;
  private yaw = 0;
  private pitch = 0;
  private lastFireAtMs = 0;

  constructor(root: HTMLElement) {
    this.range = createRangeScene(root);
    this.range.setWeaponModel(this.weaponId);
    this.bindInput();
    this.syncHud();
    this.hud.setPrompt("Klikni do střelnice");
    this.range.renderer.setAnimationLoop(() => this.update());
  }

  private bindInput(): void {
    this.range.renderer.domElement.addEventListener("click", () => {
      this.audio.resume();
      if (document.pointerLockElement !== this.range.renderer.domElement) {
        void this.range.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.range.renderer.domElement;
      if (!this.pointerLocked) {
        this.mouseDown = false;
      }
      this.syncPrompt();
      this.syncHud();
    });

    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) {
        return;
      }

      const sensitivity = 0.0021;
      this.yaw -= event.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * sensitivity, -1.18, 1.05);
      this.applyCameraRotation();
    });

    document.addEventListener("keydown", (event) => {
      this.pressedKeys.add(event.code);

      if (event.repeat) {
        return;
      }

      if (event.code === "Digit1") {
        this.equipWeapon("pistol");
      }

      if (event.code === "Digit2") {
        this.equipWeapon("assault");
      }

      if (event.code === "KeyR") {
        this.resetRound();
      }
    });

    document.addEventListener("keyup", (event) => {
      this.pressedKeys.delete(event.code);
    });

    document.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || !this.pointerLocked) {
        return;
      }

      this.mouseDown = true;
      const weapon = getWeapon(this.weaponId);
      if (!weapon.automatic) {
        this.tryFire();
      }
    });

    document.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.mouseDown = false;
      }
    });

    window.addEventListener("blur", () => {
      this.mouseDown = false;
      this.pressedKeys.clear();
    });
  }

  private update(): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.updateMovement(deltaSeconds);
    this.updateTarget(deltaSeconds);
    this.range.updateEffects(deltaSeconds);
    this.hud.updateNpcBubblePosition(this.range.npcAnchor, this.range.camera);

    if (this.pointerLocked && this.mouseDown && getWeapon(this.weaponId).automatic) {
      this.tryFire();
    }

    this.syncHud();
    this.range.renderer.render(this.range.scene, this.range.camera);
  }

  private updateMovement(deltaSeconds: number): void {
    if (!this.pointerLocked) {
      return;
    }

    const forward = (this.pressedKeys.has("KeyW") ? 1 : 0) - (this.pressedKeys.has("KeyS") ? 1 : 0);
    const strafe = (this.pressedKeys.has("KeyD") ? 1 : 0) - (this.pressedKeys.has("KeyA") ? 1 : 0);
    const move = new THREE.Vector3(strafe, 0, -forward);

    if (move.lengthSq() === 0) {
      return;
    }

    move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.range.player.position.addScaledVector(move, 3.6 * deltaSeconds);
    this.range.player.position.x = THREE.MathUtils.clamp(this.range.player.position.x, -1.15, 1.15);
    this.range.player.position.z = THREE.MathUtils.clamp(this.range.player.position.z, 1.45, 3.82);
    this.range.player.position.y = 1.62;
  }

  private updateTarget(deltaSeconds: number): void {
    const target = this.range.target.group;
    const speed = 8.4;

    if (this.targetMode === "returning") {
      target.position.z = moveTowards(target.position.z, this.range.target.nearZ, speed * deltaSeconds);
      if (target.position.z === this.range.target.nearZ) {
        this.targetMode = "near";
        this.syncPrompt();
      }
    }

    if (this.targetMode === "sending") {
      target.position.z = moveTowards(target.position.z, this.range.target.farZ, speed * deltaSeconds);
      if (target.position.z === this.range.target.farZ) {
        this.targetMode = "ready";
        this.syncPrompt();
      }
    }
  }

  private tryFire(): void {
    const now = performance.now();
    const weapon = getWeapon(this.weaponId);

    if (!this.pointerLocked) {
      this.mouseDown = false;
      return;
    }

    if (this.roundCompleted || this.targetMode !== "ready") {
      this.audio.playDryFire();
      return;
    }

    if (now - this.lastFireAtMs < weapon.fireDelayMs) {
      return;
    }

    if (this.ammo <= 0) {
      this.completeRound();
      this.audio.playDryFire();
      return;
    }

    this.lastFireAtMs = now;
    this.ammo -= 1;
    this.audio.playShot(this.weaponId);
    this.range.showMuzzleFlash(this.weaponId);
    this.applyRecoil(weapon.recoil, weapon.damageKick);

    const shot = this.castShot(now);
    this.shots.push(shot);

    if (shot.hit) {
      this.audio.playHit();
    }

    if (this.ammo === 0) {
      this.completeRound();
    }
  }

  private castShot(now: number): ShotRecord {
    const weapon = getWeapon(this.weaponId);
    const randomSpread = weapon.spread + Math.min(this.shots.length, 8) * weapon.spread * 0.035;

    this.range.camera.getWorldPosition(this.shotOrigin);
    this.shotDirection
      .set(randomBetween(-randomSpread, randomSpread), randomBetween(-randomSpread, randomSpread), -1)
      .normalize();
    this.range.camera.getWorldQuaternion(this.cameraQuaternion);
    this.shotDirection.applyQuaternion(this.cameraQuaternion);

    this.raycaster.set(this.shotOrigin, this.shotDirection);
    this.raycaster.far = 80;
    const targetHit = this.raycaster.intersectObject(this.range.target.surface, false)[0];

    if (!targetHit) {
      return {
        hit: false,
        distance: null,
        ring: 0,
        score: 0,
        firedAtMs: now - this.roundStartedAtMs,
      };
    }

    const localPoint = this.range.target.surface.worldToLocal(targetHit.point.clone());
    const distance = Math.sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);
    const ring = calculateRing(distance);

    if (ring === 0 || distance > TARGET_RADIUS) {
      return {
        hit: false,
        distance: null,
        ring: 0,
        score: 0,
        firedAtMs: now - this.roundStartedAtMs,
      };
    }

    this.range.target.addBulletHole(localPoint.x, localPoint.y, ring);
    return {
      hit: true,
      distance,
      ring,
      score: ring,
      firedAtMs: now - this.roundStartedAtMs,
    };
  }

  private completeRound(): void {
    if (this.roundCompleted) {
      return;
    }

    this.roundCompleted = true;
    this.mouseDown = false;
    this.targetMode = "returning";
    const stats = summarizeRound(this.weaponId, this.shots, performance.now() - this.roundStartedAtMs);
    this.hud.showRoundResult(stats);
    this.hud.setNpcPending();
    this.syncPrompt();
    void this.requestNpcCommentary(stats);
  }

  private async requestNpcCommentary(stats: RoundStats): Promise<void> {
    try {
      const response = await fetch("/api/npc-commentary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weapon: stats.weapon,
          shots: stats.shots,
          hits: stats.hits,
          accuracy: stats.accuracy,
          avgDistance: stats.avgDistance,
          bestRing: stats.bestRing,
          durationMs: stats.durationMs,
        }),
      });

      if (!response.ok) {
        throw new Error(`NPC commentary failed: ${response.status}`);
      }

      const commentary = (await response.json()) as NpcCommentaryResponse;
      if (!commentary.text || (commentary.source !== "groq" && commentary.source !== "fallback")) {
        throw new Error("NPC commentary response has an invalid shape");
      }

      this.hud.setNpcComment(commentary);
    } catch {
      this.hud.setNpcComment({
        text: buildLocalCommentary(stats),
        source: "fallback",
      });
    }
  }

  private resetRound(): void {
    const weapon = getWeapon(this.weaponId);
    this.ammo = weapon.magazineSize;
    this.shots = [];
    this.roundStartedAtMs = performance.now();
    this.roundCompleted = false;
    this.mouseDown = false;
    this.targetMode = this.range.target.group.position.z === this.range.target.farZ ? "ready" : "sending";
    this.range.target.clearBulletHoles();
    this.hud.hideRoundResult();
    this.hud.setNpcComment({
      text: `${weapon.label} je nabitá. Teď mi ukaž, že to nebyla náhoda.`,
      source: "fallback",
    });
    this.syncPrompt();
    this.syncHud();
  }

  private equipWeapon(id: WeaponId): void {
    if (this.weaponId === id) {
      return;
    }

    this.weaponId = id;
    this.range.setWeaponModel(id);
    this.resetRound();
  }

  private applyRecoil(amount: number, kick: number): void {
    this.pitch = THREE.MathUtils.clamp(this.pitch - amount * kick, -1.18, 1.05);
    this.yaw += randomBetween(-amount * 0.28, amount * 0.28);
    this.applyCameraRotation();
  }

  private applyCameraRotation(): void {
    this.range.player.rotation.y = this.yaw;
    this.range.camera.rotation.x = this.pitch;
  }

  private syncHud(): void {
    const liveStats = summarizeRound(this.weaponId, this.shots, performance.now() - this.roundStartedAtMs);
    this.hud.updateStatus({
      weapon: getWeapon(this.weaponId),
      ammo: this.ammo,
      shots: this.shots.length,
      hits: liveStats.hits,
      accuracy: liveStats.accuracy,
      targetMode: this.targetMode,
      pointerLocked: this.pointerLocked,
    });
  }

  private syncPrompt(): void {
    if (this.roundCompleted || this.targetMode === "near") {
      this.hud.setPrompt("R - nový zásobník");
      return;
    }

    if (this.targetMode === "returning") {
      this.hud.setPrompt("Terč jede k tobě");
      return;
    }

    if (this.targetMode === "sending") {
      this.hud.setPrompt("Terč odjíždí na linku");
      return;
    }

    this.hud.setPrompt(this.pointerLocked ? "" : "Klikni do střelnice");
  }
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

new ShootingRangeGame(canvasRoot);
