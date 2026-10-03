// MIT adapter; engine.js and linked source retain GPL-3.0-or-later terms.
import createEngine from "./engine.js";
let loading;
function engine() {
  return (loading ??= Promise.resolve(createEngine()).catch((error) => {
    loading = undefined;
    throw error;
  }));
}
export async function phonemize(text, language = "en-us") {
  if (typeof text !== "string") throw new TypeError("Expected text");
  const voices = await list_voices();
  const matches = voices.flatMap((voice) =>
    voice.languages
      .filter((value) => value.name === language)
      .map((value) => ({ voice, priority: value.priority })),
  );
  const selected =
    voices.find((voice) => voice.identifier === language) ??
    matches.toSorted((a, b) => a.priority - b.priority)[0]?.voice;
  if (!selected) throw new Error("Unsupported English voice");
  const module = await engine();
  const pointer = module.ccall(
    "reel_phonemize",
    "number",
    ["string", "string"],
    [text, selected.identifier],
  );
  if (!pointer)
    throw new Error(
      `eSpeak phonemization failed (${module.ccall("reel_error", "number", [], [])})`,
    );
  try {
    return module
      .UTF8ToString(pointer)
      .split("\n")
      .filter((line) => line.trim().length);
  } finally {
    module._free(pointer);
  }
}
export async function list_voices(language) {
  const module = await engine();
  const pointer = module.ccall("reel_voices", "number", [], []);
  if (!pointer) throw new Error("Could not list eSpeak voices");
  try {
    const voices = JSON.parse(module.UTF8ToString(pointer))
      .map((voice) => ({
        ...voice,
        languages: voice.languages.filter(
          (value) => value.name.split("-")[0] === "en",
        ),
      }))
      .filter((voice) => voice.languages.length);
    if (!language) return voices;
    const base = language.split("-")[0];
    return voices.filter((voice) =>
      voice.languages.some(
        (value) => value.name === base || value.name.startsWith(`${base}-`),
      ),
    );
  } finally {
    module._free(pointer);
  }
}
