import * as THREE from "three";
import type { NpcCommentaryResponse, RoundStats, TargetMode, WeaponDefinition } from "../game/types";

interface HudElements {
  weaponName: HTMLElement;
  ammoCount: HTMLElement;
  accuracy: HTMLElement;
  hitValue: HTMLElement;
  prompt: HTMLElement;
  resultPanel: HTMLElement;
  resultStats: HTMLElement;
  npcBubble: HTMLElement;
  npcText: HTMLElement;
  npcSource: HTMLElement;
  crosshair: HTMLElement;
}

export class Hud {
  private readonly elements: HudElements;

  constructor() {
    this.elements = {
      weaponName: getElement("weapon-name"),
      ammoCount: getElement("ammo-count"),
      accuracy: getElement("accuracy-value"),
      hitValue: getElement("hit-value"),
      prompt: getElement("prompt"),
      resultPanel: getElement("result-panel"),
      resultStats: getElement("result-stats"),
      npcBubble: getElement("npc-bubble"),
      npcText: getElement("npc-text"),
      npcSource: getElement("npc-source"),
      crosshair: getElement("crosshair"),
    };
  }

  updateStatus(params: {
    weapon: WeaponDefinition;
    ammo: number;
    shots: number;
    hits: number;
    accuracy: number;
    targetMode: TargetMode;
    pointerLocked: boolean;
  }): void {
    this.elements.weaponName.textContent = params.weapon.label;
    this.elements.ammoCount.textContent = `${params.ammo} / ${params.weapon.magazineSize}`;
    this.elements.accuracy.textContent = `${params.accuracy.toFixed(params.accuracy % 1 === 0 ? 0 : 1)}%`;
    this.elements.hitValue.textContent = `${params.hits} / ${params.shots}`;
    this.elements.crosshair.classList.toggle("crosshair--locked", params.pointerLocked && params.targetMode === "ready");
  }

  setPrompt(text: string): void {
    this.elements.prompt.textContent = text;
    this.elements.prompt.classList.toggle("prompt--hidden", text.length === 0);
  }

  showRoundResult(stats: RoundStats): void {
    this.elements.resultPanel.hidden = false;
    this.elements.resultStats.innerHTML = "";
    const rows: Array<[string, string]> = [
      ["Přesnost", `${stats.accuracy}%`],
      ["Zásahy", `${stats.hits} / ${stats.shots}`],
      ["Skóre", `${stats.score}`],
      ["Nejlepší kruh", `${stats.bestRing}`],
      ["Průměr od středu", stats.avgDistance === null ? "bez zásahu" : `${stats.avgDistance.toFixed(2)} m`],
    ];

    for (const [label, value] of rows) {
      const item = document.createElement("div");
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      this.elements.resultStats.appendChild(item);
    }
  }

  hideRoundResult(): void {
    this.elements.resultPanel.hidden = true;
    this.elements.resultStats.innerHTML = "";
  }

  setNpcPending(): void {
    this.elements.npcText.textContent = "Počkej. Počítám, jak moc jsi to rozstřílel.";
    this.elements.npcSource.textContent = "analýza...";
    this.elements.npcBubble.classList.add("npc-bubble--thinking");
  }

  setNpcComment(commentary: NpcCommentaryResponse): void {
    this.elements.npcText.textContent = commentary.text;
    this.elements.npcSource.textContent = getNpcSourceLabel(commentary);
    this.elements.npcBubble.classList.remove("npc-bubble--thinking");
  }

  updateNpcBubblePosition(anchor: THREE.Object3D, camera: THREE.Camera): void {
    const position = new THREE.Vector3();
    anchor.getWorldPosition(position);
    position.project(camera);

    const visible = position.z < 1 && position.z > -1;
    this.elements.npcBubble.classList.toggle("npc-bubble--offscreen", !visible);
    if (!visible) {
      return;
    }

    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;
    const width = this.elements.npcBubble.offsetWidth || 360;
    const height = this.elements.npcBubble.offsetHeight || 90;
    const statusBottom = document.querySelector<HTMLElement>(".hud__status")?.getBoundingClientRect().bottom ?? 0;
    const clampedX = Math.min(Math.max(x, width / 2 + 16), window.innerWidth - width / 2 - 16);
    const minAnchorY = height + statusBottom + 20;
    const clampedY = Math.min(Math.max(y, minAnchorY), window.innerHeight - 16);
    this.elements.npcBubble.style.transform = `translate(${Math.round(clampedX)}px, ${Math.round(clampedY)}px) translate(-50%, -100%)`;
  }
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing HUD element: #${id}`);
  }

  return element;
}

function getNpcSourceLabel(commentary: NpcCommentaryResponse): string {
  if (commentary.source === "groq") {
    return "Groq AI trenér";
  }

  if (commentary.reason === "missing_groq_api_key") {
    return "fallback - chybí GROQ_API_KEY v .env";
  }

  if (commentary.reason === "groq_error") {
    return "fallback - Groq API chyba";
  }

  return "lokální fallback";
}
