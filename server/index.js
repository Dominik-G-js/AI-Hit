import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const isProduction = process.argv.includes("--production") || process.env.NODE_ENV === "production";

loadDotEnv(path.join(rootDir, ".env"));

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

app.get("/favicon.ico", (_request, response) => {
  response.redirect(302, "/favicon.svg");
});

app.post("/api/npc-commentary", async (request, response) => {
  const stats = normalizeStats(request.body);
  if (!stats) {
    response.status(400).json({ text: "Neplatná data kola.", source: "fallback", reason: "invalid_request" });
    return;
  }

  const fallback = buildFallbackCommentary(stats);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    response.json({ text: fallback, source: "fallback", reason: "missing_groq_api_key" });
    return;
  }

  try {
    const text = await requestGroqCommentary(stats, apiKey);
    response.json({ text, source: "groq" });
  } catch (error) {
    console.warn("[npc-commentary] Falling back:", error instanceof Error ? error.message : error);
    response.json({ text: fallback, source: "fallback", reason: "groq_error" });
  }
});

if (isProduction) {
  app.use(express.static(distDir, { index: false }));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT || 5173);
app.listen(port, () => {
  const mode = isProduction ? "production" : "development";
  console.log(`AI Hit shooting range running in ${mode} mode: http://127.0.0.1:${port}`);
});

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function normalizeStats(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const weapon = value.weapon === "assault" || value.weapon === "pistol" ? value.weapon : null;
  const shots = toInt(value.shots);
  const hits = toInt(value.hits);
  const accuracy = toNumber(value.accuracy);
  const avgDistance = value.avgDistance === null ? null : toNumber(value.avgDistance);
  const bestRing = toInt(value.bestRing);
  const durationMs = toInt(value.durationMs);

  if (!weapon) {
    return null;
  }

  if (
    shots === null ||
    hits === null ||
    accuracy === null ||
    bestRing === null ||
    durationMs === null ||
    hits > shots ||
    shots < 0 ||
    shots > 60 ||
    hits < 0 ||
    accuracy < 0 ||
    accuracy > 100 ||
    bestRing < 0 ||
    bestRing > 10 ||
    durationMs < 0 ||
    durationMs > 10 * 60 * 1000 ||
    (avgDistance !== null && (avgDistance < 0 || avgDistance > 2.5))
  ) {
    return null;
  }

  return {
    weapon,
    shots,
    hits,
    accuracy: Math.round(accuracy * 10) / 10,
    avgDistance,
    bestRing,
    durationMs,
    performanceBand: getPerformanceBand({ accuracy, avgDistance, bestRing }),
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toInt(value) {
  const number = toNumber(value);
  if (number === null || !Number.isInteger(number)) {
    return null;
  }

  return number;
}

async function requestGroqCommentary(stats, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "Jsi český NPC instruktor na moderní střelnici. Odpověz jako krátká bublina nad hlavou NPC. Styl: vulgární, brutálně sarkastický drill-sergeant roast. Roastni hráče pokaždé, i když střílí dobře; pochval mušku jen krátce a hned ho setři. Můžeš používat běžné české vulgarity jako kurva, sakra, doprdele, průser, posral jsi to, ale žádné slury, hate speech, sexuální obsah, výhrůžky ani útoky na chráněné skupiny. Max dvě věty, max 240 znaků.",
          },
          {
            role: "user",
            content: `Vyhodnoť zásobník: ${JSON.stringify(stats)}. Piš česky. Buď sprostý a ostrý. Když je hráč hrozný, roznes ho za výkon. Když je dobrý, uznej trefy, ale stejně ho roastni, ať neusne na úspěchu.`,
          },
        ],
        temperature: 0.85,
        max_completion_tokens: 110,
      }),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API returned ${groqResponse.status}`);
    }

    const payload = await groqResponse.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Groq API returned no text");
    }

    return sanitizeCommentary(text);
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeCommentary(text) {
  const collapsed = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return collapsed.length > 260 ? `${collapsed.slice(0, 257)}...` : collapsed;
}

function getPerformanceBand(stats) {
  const distance = stats.avgDistance ?? 1.2;
  if (stats.accuracy >= 88 && distance <= 0.32 && stats.bestRing >= 9) {
    return "elite";
  }

  if (stats.accuracy >= 68 && stats.bestRing >= 7) {
    return "good";
  }

  if (stats.accuracy >= 38) {
    return "rough";
  }

  return "terrible";
}

function buildFallbackCommentary(stats) {
  switch (stats.performanceBand) {
    case "elite":
      return `Kurva, ${stats.accuracy}% přesnost a kruh ${stats.bestRing}. Výborně, ale nečum na sebe jak legenda, ještě pořád jsi jen střelec s egem.`;
    case "good":
      return `${stats.accuracy}% přesnost. Slušné, ale ty ulítlé rány byly debilní výmluva za disciplínu, ne střelba.`;
    case "rough":
      return `${stats.accuracy}% přesnost. Něco trefuješ, zbytek je bordel. Dej ruce dohromady, protože tohle je střelecký průser s pár světlými momenty.`;
    default:
      return `${stats.accuracy}% přesnost. Doprdele, terč stojí před tebou a ty to kropíš jako panika. Zpomal, dýchej a přestaň to takhle posírat.`;
  }
}
