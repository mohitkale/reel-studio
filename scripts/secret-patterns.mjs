/** Findings deliberately omit matched values: scanner output can enter public CI logs. */
const rules = [
  [
    "Private key material",
    /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
  ],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g,
  ],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["OpenAI-style key", /\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{20,}\b/g],
  ["Cartesia-style key", /\bsk_car_[A-Za-z0-9_-]{20,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  // Cover dotenv and source/config assignments without assuming all opaque keys
  // have a vendor-specific prefix. Placeholders are excluded below.
  [
    "Assigned provider credential",
    /["']?\b(?:CARTESIA_API_KEY|ELEVENLABS_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|PEXELS_API_KEY|PIXABAY_API_KEY|UNSPLASH_ACCESS_KEY|JAMENDO_CLIENT_ID|VOICEFORGE_API_TOKEN|MCP_API_TOKEN|OLLAMA_API_KEY|LM_STUDIO_API_KEY)\b["']?\s*(?:=|:)\s*["']?([A-Za-z0-9._:-]{12,})/g,
  ],
];
const placeholder =
  /^(?:your[_-]|example[_-]|placeholder|test[_-]|dummy[_-]|changeme|replace[_-]|<|\$)/i;

export function scanSecretText(content) {
  const findings = [];
  for (const [name, pattern] of rules) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (name === "Assigned provider credential" && placeholder.test(match[1]))
        continue;
      findings.push({
        line: content.slice(0, match.index).split(/\r?\n/).length,
        rule: name,
      });
    }
  }
  return findings;
}
