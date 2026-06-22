/**
 * Seed script: creates sample AI/tech assets (images + Lottie JSON) and
 * inserts them into the local SQLite database so the Assets page has content.
 *
 * Run once:  npx tsx scripts/seed-assets.ts
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MEDIA_ROOT = path.join(process.cwd(), "media");

// ---------------------------------------------------------------------------
// SVG image assets — AI / tech themed
// ---------------------------------------------------------------------------

const SVG_IMAGES: { name: string; content: string }[] = [
  {
    name: "neural-network.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="400" height="400" fill="#08070d"/>
  <!-- Input layer -->
  <circle cx="60" cy="120" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="60" cy="200" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="60" cy="280" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Hidden layer 1 -->
  <circle cx="160" cy="100" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="160" cy="170" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="160" cy="240" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="160" cy="310" r="18" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Hidden layer 2 -->
  <circle cx="260" cy="130" r="18" fill="#1a0f33" stroke="#22d3ee" stroke-width="2"/>
  <circle cx="260" cy="200" r="18" fill="#1a0f33" stroke="#22d3ee" stroke-width="2"/>
  <circle cx="260" cy="270" r="18" fill="#1a0f33" stroke="#22d3ee" stroke-width="2"/>
  <!-- Output layer -->
  <circle cx="360" cy="160" r="18" fill="#8b5cf6" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="360" cy="240" r="18" fill="#8b5cf6" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Connections input → h1 -->
  <line x1="78" y1="120" x2="142" y2="100" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="120" x2="142" y2="170" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="120" x2="142" y2="240" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="200" x2="142" y2="100" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="200" x2="142" y2="170" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="200" x2="142" y2="310" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="280" x2="142" y2="240" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <line x1="78" y1="280" x2="142" y2="310" stroke="#8b5cf6" stroke-width="0.8" opacity="0.4"/>
  <!-- Connections h1 → h2 -->
  <line x1="178" y1="100" x2="242" y2="130" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <line x1="178" y1="170" x2="242" y2="130" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <line x1="178" y1="170" x2="242" y2="200" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <line x1="178" y1="240" x2="242" y2="200" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <line x1="178" y1="240" x2="242" y2="270" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <line x1="178" y1="310" x2="242" y2="270" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"/>
  <!-- Connections h2 → output -->
  <line x1="278" y1="130" x2="342" y2="160" stroke="#8b5cf6" stroke-width="1.5" opacity="0.7"/>
  <line x1="278" y1="200" x2="342" y2="160" stroke="#8b5cf6" stroke-width="1.5" opacity="0.7"/>
  <line x1="278" y1="200" x2="342" y2="240" stroke="#8b5cf6" stroke-width="1.5" opacity="0.7"/>
  <line x1="278" y1="270" x2="342" y2="240" stroke="#8b5cf6" stroke-width="1.5" opacity="0.7"/>
  <!-- Labels -->
  <text x="200" y="368" text-anchor="middle" fill="#b7b3c7" font-size="13" font-family="sans-serif">Neural Network</text>
</svg>`,
  },
  {
    name: "data-pipeline.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#08070d"/>
  <!-- Stage boxes -->
  <rect x="20" y="110" width="80" height="80" rx="12" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <text x="60" y="148" text-anchor="middle" fill="#ffffff" font-size="11" font-family="sans-serif">Ingest</text>
  <text x="60" y="163" text-anchor="middle" fill="#b7b3c7" font-size="9" font-family="sans-serif">Raw data</text>
  <rect x="140" y="110" width="80" height="80" rx="12" fill="#1a0f33" stroke="#22d3ee" stroke-width="2"/>
  <text x="180" y="148" text-anchor="middle" fill="#ffffff" font-size="11" font-family="sans-serif">Transform</text>
  <text x="180" y="163" text-anchor="middle" fill="#b7b3c7" font-size="9" font-family="sans-serif">Clean + embed</text>
  <rect x="260" y="110" width="80" height="80" rx="12" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <text x="300" y="148" text-anchor="middle" fill="#ffffff" font-size="11" font-family="sans-serif">Store</text>
  <text x="300" y="163" text-anchor="middle" fill="#b7b3c7" font-size="9" font-family="sans-serif">Vector DB</text>
  <!-- Arrows -->
  <line x1="101" y1="150" x2="138" y2="150" stroke="#8b5cf6" stroke-width="2"/>
  <polygon points="136,145 144,150 136,155" fill="#8b5cf6"/>
  <line x1="221" y1="150" x2="258" y2="150" stroke="#22d3ee" stroke-width="2"/>
  <polygon points="256,145 264,150 256,155" fill="#22d3ee"/>
  <!-- Top label -->
  <text x="200" y="40" text-anchor="middle" fill="#ffffff" font-size="16" font-family="sans-serif" font-weight="bold">AI Data Pipeline</text>
  <text x="200" y="60" text-anchor="middle" fill="#b7b3c7" font-size="11" font-family="sans-serif">Ingest · Transform · Store · Serve</text>
  <!-- Bottom stage -->
  <rect x="355" y="110" width="25" height="80" rx="8" fill="#8b5cf6" opacity="0.3"/>
  <text x="367" y="155" text-anchor="middle" fill="#8b5cf6" font-size="9" font-family="sans-serif" transform="rotate(90,367,155)">Serve</text>
  <line x1="341" y1="150" x2="354" y2="150" stroke="#8b5cf6" stroke-width="2"/>
  <polygon points="352,145 360,150 352,155" fill="#8b5cf6"/>
  <text x="200" y="235" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">Powered by embeddings + vector search</text>
</svg>`,
  },
  {
    name: "ai-chatbot.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="400" height="400" fill="#08070d"/>
  <!-- Bot head -->
  <rect x="130" y="60" width="140" height="130" rx="24" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2.5"/>
  <!-- Eyes -->
  <circle cx="170" cy="115" r="14" fill="#08070d"/>
  <circle cx="230" cy="115" r="14" fill="#08070d"/>
  <circle cx="170" cy="115" r="7" fill="#8b5cf6"/>
  <circle cx="230" cy="115" r="7" fill="#22d3ee"/>
  <!-- Mouth / progress bar -->
  <rect x="158" y="153" width="84" height="10" rx="5" fill="#08070d"/>
  <rect x="158" y="153" width="52" height="10" rx="5" fill="#8b5cf6"/>
  <!-- Antenna -->
  <line x1="200" y1="60" x2="200" y2="38" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="200" cy="32" r="7" fill="#22d3ee"/>
  <!-- Body -->
  <rect x="145" y="200" width="110" height="70" rx="16" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Neck -->
  <rect x="188" y="190" width="24" height="16" rx="4" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Arms -->
  <rect x="90" y="205" width="55" height="22" rx="11" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <rect x="255" y="205" width="55" height="22" rx="11" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <!-- Chat bubble -->
  <rect x="240" y="50" width="130" height="52" rx="14" fill="#8b5cf6" opacity="0.15" stroke="#8b5cf6" stroke-width="1.5"/>
  <text x="305" y="73" text-anchor="middle" fill="#8b5cf6" font-size="10" font-family="sans-serif">How can I</text>
  <text x="305" y="88" text-anchor="middle" fill="#8b5cf6" font-size="10" font-family="sans-serif">help you?</text>
  <!-- Label -->
  <text x="200" y="320" text-anchor="middle" fill="#ffffff" font-size="15" font-family="sans-serif" font-weight="bold">AI Assistant</text>
  <text x="200" y="342" text-anchor="middle" fill="#b7b3c7" font-size="11" font-family="sans-serif">Always ready · Always learning</text>
</svg>`,
  },
  {
    name: "model-training.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="400" height="400" fill="#08070d"/>
  <!-- Chart area -->
  <rect x="50" y="50" width="300" height="220" rx="12" fill="#1a0f33" stroke="#8b5cf6" stroke-width="1.5" opacity="0.6"/>
  <!-- Grid lines -->
  <line x1="70" y1="240" x2="330" y2="240" stroke="#b7b3c7" stroke-width="0.5" opacity="0.3"/>
  <line x1="70" y1="200" x2="330" y2="200" stroke="#b7b3c7" stroke-width="0.5" opacity="0.3"/>
  <line x1="70" y1="160" x2="330" y2="160" stroke="#b7b3c7" stroke-width="0.5" opacity="0.3"/>
  <line x1="70" y1="120" x2="330" y2="120" stroke="#b7b3c7" stroke-width="0.5" opacity="0.3"/>
  <line x1="70" y1="80" x2="330" y2="80" stroke="#b7b3c7" stroke-width="0.5" opacity="0.3"/>
  <!-- Training loss curve (decreasing) -->
  <polyline
    points="70,220 110,200 150,175 185,148 215,125 245,108 275,97 305,90 330,86"
    fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Validation loss curve -->
  <polyline
    points="70,225 110,205 150,183 185,158 215,138 245,125 275,118 305,116 330,118"
    fill="none" stroke="#22d3ee" stroke-width="2" stroke-linejoin="round" stroke-dasharray="6,3"/>
  <!-- Axes -->
  <line x1="70" y1="60" x2="70" y2="248" stroke="#b7b3c7" stroke-width="1" opacity="0.6"/>
  <line x1="70" y1="248" x2="338" y2="248" stroke="#b7b3c7" stroke-width="1" opacity="0.6"/>
  <!-- Axis labels -->
  <text x="30" y="155" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif" transform="rotate(-90,30,155)">Loss</text>
  <text x="200" y="268" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">Epoch</text>
  <!-- Legend -->
  <line x1="80" y1="295" x2="105" y2="295" stroke="#8b5cf6" stroke-width="2.5"/>
  <text x="112" y="299" fill="#8b5cf6" font-size="11" font-family="sans-serif">Train</text>
  <line x1="165" y1="295" x2="190" y2="295" stroke="#22d3ee" stroke-width="2" stroke-dasharray="6,3"/>
  <text x="197" y="299" fill="#22d3ee" font-size="11" font-family="sans-serif">Validation</text>
  <!-- Title -->
  <text x="200" y="340" text-anchor="middle" fill="#ffffff" font-size="15" font-family="sans-serif" font-weight="bold">Model Training</text>
  <text x="200" y="362" text-anchor="middle" fill="#b7b3c7" font-size="11" font-family="sans-serif">Loss decreasing over epochs</text>
</svg>`,
  },
  {
    name: "llm-stack.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 420" width="400" height="420">
  <rect width="400" height="420" fill="#08070d"/>
  <text x="200" y="38" text-anchor="middle" fill="#ffffff" font-size="16" font-family="sans-serif" font-weight="bold">LLM Application Stack</text>
  <!-- Stack layers bottom to top -->
  <rect x="40" y="340" width="320" height="48" rx="10" fill="#1a0f33" stroke="#b7b3c7" stroke-width="1.5"/>
  <text x="200" y="360" text-anchor="middle" fill="#b7b3c7" font-size="12" font-family="sans-serif">Infrastructure (GPU / Cloud)</text>
  <text x="200" y="378" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">H100 · A100 · TPU</text>

  <rect x="40" y="278" width="320" height="48" rx="10" fill="#1a0f33" stroke="#8b5cf6" stroke-width="1.5"/>
  <text x="200" y="298" text-anchor="middle" fill="#8b5cf6" font-size="12" font-family="sans-serif">Foundation Model</text>
  <text x="200" y="316" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">Claude · GPT-4 · Llama · Gemini</text>

  <rect x="40" y="216" width="320" height="48" rx="10" fill="#1a0f33" stroke="#22d3ee" stroke-width="1.5"/>
  <text x="200" y="236" text-anchor="middle" fill="#22d3ee" font-size="12" font-family="sans-serif">Context Layer</text>
  <text x="200" y="254" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">RAG · Embeddings · Memory</text>

  <rect x="40" y="154" width="320" height="48" rx="10" fill="#1a0f33" stroke="#8b5cf6" stroke-width="2"/>
  <text x="200" y="174" text-anchor="middle" fill="#ffffff" font-size="12" font-family="sans-serif" font-weight="600">Orchestration</text>
  <text x="200" y="192" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">LangChain · LlamaIndex · Custom</text>

  <rect x="40" y="92" width="320" height="48" rx="10" fill="#8b5cf6" opacity="0.25" stroke="#8b5cf6" stroke-width="2"/>
  <text x="200" y="112" text-anchor="middle" fill="#ffffff" font-size="12" font-family="sans-serif" font-weight="700">Application</text>
  <text x="200" y="130" text-anchor="middle" fill="#b7b3c7" font-size="10" font-family="sans-serif">Your product · UI · APIs · Agents</text>

  <!-- Connecting arrows -->
  <line x1="200" y1="340" x2="200" y2="328" stroke="#8b5cf6" stroke-width="1.5"/>
  <polygon points="196,330 200,322 204,330" fill="#8b5cf6"/>
  <line x1="200" y1="278" x2="200" y2="266" stroke="#22d3ee" stroke-width="1.5"/>
  <polygon points="196,268 200,260 204,268" fill="#22d3ee"/>
  <line x1="200" y1="216" x2="200" y2="204" stroke="#8b5cf6" stroke-width="1.5"/>
  <polygon points="196,206 200,198 204,206" fill="#8b5cf6"/>
  <line x1="200" y1="154" x2="200" y2="142" stroke="#8b5cf6" stroke-width="1.5"/>
  <polygon points="196,144 200,136 204,144" fill="#8b5cf6"/>
</svg>`,
  },
];

// ---------------------------------------------------------------------------
// Lottie JSON assets — simple animations for AI / tech
// ---------------------------------------------------------------------------

const LOTTIE_ANIMATIONS: { name: string; content: object }[] = [
  {
    name: "loading-spinner.json",
    content: {
      v: "5.9.0", fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: "Loading Spinner",
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: "Ring", sr: 1,
        ks: {
          o: { a: 0, k: 100 }, r: { a: 1, k: [{ i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 0, s: [0] }, { t: 60, s: [360] }] },
          p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [{
          ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] },
        }, {
          ty: "st", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 12 },
          lc: 2, lj: 2, d: [{ n: "d", nm: "dash", v: { a: 0, k: 180 } }, { n: "g", nm: "gap", v: { a: 0, k: 200 } }, { n: "o", nm: "offset", v: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] } }],
        }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }],
        ip: 0, op: 60, st: 0,
      }],
    },
  },
  {
    name: "success-check.json",
    content: {
      v: "5.9.0", fr: 30, ip: 0, op: 45, w: 200, h: 200, nm: "Success Check",
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: "Circle", sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ i: { x: [0.175], y: [1.175] }, o: { x: [0.5], y: [0] }, t: 0, s: [0, 0, 100] }, { t: 20, s: [100, 100, 100] }] } },
        ao: 0,
        shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 140] } }, { ty: "fl", c: { a: 0, k: [0.133, 0.827, 0.933, 0.15] }, o: { a: 0, k: 100 } }, { ty: "st", c: { a: 0, k: [0.133, 0.827, 0.933, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 6 }, lc: 2, lj: 2 }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }],
        ip: 0, op: 45, st: 0,
      }, {
        ddd: 0, ind: 2, ty: 4, nm: "Check", sr: 1,
        ks: { o: { a: 1, k: [{ t: 15, s: [0] }, { t: 25, s: [100] }] }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [{ ty: "sh", ks: { a: 0, k: { i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[-30,0],[-10,20],[30,-20]], c: false } } }, { ty: "st", c: { a: 0, k: [0.133, 0.827, 0.933, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 10 }, lc: 2, lj: 2 }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }],
        ip: 0, op: 45, st: 0,
      }],
    },
  },
  {
    name: "pulse-ring.json",
    content: {
      v: "5.9.0", fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: "Pulse Ring",
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: "Ring 1", sr: 1,
        ks: { o: { a: 1, k: [{ t: 0, s: [80] }, { t: 60, s: [0] }] }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 0, s: [30, 30, 100] }, { t: 60, s: [160, 160, 100] }] } },
        ao: 0,
        shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [60, 60] } }, { ty: "st", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 4 }, lc: 2, lj: 2 }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }],
        ip: 0, op: 60, st: 0,
      }, {
        ddd: 0, ind: 2, ty: 4, nm: "Core", sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } }, { ty: "fl", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }],
        ip: 0, op: 60, st: 0,
      }],
    },
  },
  {
    name: "typing-dots.json",
    content: {
      v: "5.9.0", fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: "Typing Dots",
      layers: [
        { ddd: 0, ind: 1, ty: 4, nm: "Dot 1", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [60, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 0, s: [100, 100, 100] }, { i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 15, s: [100, 60, 100] }, { t: 30, s: [100, 100, 100] }] } }, ao: 0, shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [28, 28] } }, { ty: "fl", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 60, st: 0 },
        { ddd: 0, ind: 2, ty: 4, nm: "Dot 2", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 10, s: [100, 100, 100] }, { i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 25, s: [100, 60, 100] }, { t: 40, s: [100, 100, 100] }] } }, ao: 0, shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [28, 28] } }, { ty: "fl", c: { a: 0, k: [0.133, 0.827, 0.933, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 60, st: 0 },
        { ddd: 0, ind: 3, ty: 4, nm: "Dot 3", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [140, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 20, s: [100, 100, 100] }, { i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 35, s: [100, 60, 100] }, { t: 50, s: [100, 100, 100] }] } }, ao: 0, shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [28, 28] } }, { ty: "fl", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 60, st: 0 },
      ],
    },
  },
  {
    name: "data-flow.json",
    content: {
      v: "5.9.0", fr: 30, ip: 0, op: 90, w: 200, h: 200, nm: "Data Flow",
      layers: [
        { ddd: 0, ind: 1, ty: 4, nm: "Particle 1", sr: 1, ks: { o: { a: 1, k: [{ t: 0, s: [0] }, { t: 5, s: [100] }, { t: 75, s: [100] }, { t: 90, s: [0] }] }, r: { a: 0, k: 0 }, p: { a: 1, k: [{ i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 0, s: [20, 100, 0] }, { t: 90, s: [180, 100, 0] }] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, ao: 0, shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [18, 18] } }, { ty: "fl", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 90, st: 0 },
        { ddd: 0, ind: 2, ty: 4, nm: "Particle 2", sr: 1, ks: { o: { a: 1, k: [{ t: 20, s: [0] }, { t: 25, s: [100] }, { t: 85, s: [100] }, { t: 90, s: [0] }] }, r: { a: 0, k: 0 }, p: { a: 1, k: [{ i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 20, s: [20, 130, 0] }, { t: 90, s: [180, 70, 0] }] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, ao: 0, shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [14, 14] } }, { ty: "fl", c: { a: 0, k: [0.133, 0.827, 0.933, 1] }, o: { a: 0, k: 100 } }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 90, st: 0 },
        { ddd: 0, ind: 3, ty: 4, nm: "Track", sr: 1, ks: { o: { a: 0, k: 30 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, ao: 0, shapes: [{ ty: "sh", ks: { a: 0, k: { i: [[0,0],[0,0]], o: [[0,0],[0,0]], v: [[-80,0],[80,0]], c: false } } }, { ty: "st", c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 }, lc: 2, lj: 2 }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }], ip: 0, op: 90, st: 0 },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding sample assets...");

  const imgDir = path.join(MEDIA_ROOT, "assets", "images");
  const lotDir = path.join(MEDIA_ROOT, "assets", "lottie");
  await fs.mkdir(imgDir, { recursive: true });
  await fs.mkdir(lotDir, { recursive: true });

  for (const svg of SVG_IMAGES) {
    const id = randomUUID();
    const filename = `${id}.svg`;
    const filePath = path.join(imgDir, filename);
    const storagePath = `assets/images/${filename}`;

    await fs.writeFile(filePath, svg.content, "utf-8");

    await prisma.asset.create({
      data: {
        id,
        type: "image",
        name: svg.name.replace(".svg", "").replace(/-/g, " "),
        path: storagePath,
        meta: JSON.stringify({ ext: "svg", originalName: svg.name }),
      },
    });

    console.log(`  + image: ${svg.name}`);
  }

  for (const anim of LOTTIE_ANIMATIONS) {
    const id = randomUUID();
    const filename = `${id}.json`;
    const filePath = path.join(lotDir, filename);
    const storagePath = `assets/lottie/${filename}`;

    await fs.writeFile(filePath, JSON.stringify(anim.content, null, 2), "utf-8");

    await prisma.asset.create({
      data: {
        id,
        type: "lottie",
        name: anim.name.replace(".json", "").replace(/-/g, " "),
        path: storagePath,
        meta: JSON.stringify({ ext: "json", originalName: anim.name }),
      },
    });

    console.log(`  + lottie: ${anim.name}`);
  }

  console.log("Done. 5 images + 5 Lottie animations created.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
