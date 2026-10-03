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
  if (
    !voices.some(
      (voice) =>
        voice.identifier === language ||
        voice.languages.some((value) => value.name === language),
    )
  )
    throw new Error("Unsupported English voice");
  const module = await engine();
  const pointer = module.ccall(
    "reel_phonemize",
    "number",
    ["string", "string"],
    [text, language],
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
export async function list_voices() {
  const module = await engine();
  const pointer = module.ccall("reel_voices", "number", [], []);
  if (!pointer) throw new Error("Could not list eSpeak voices");
  try {
    return JSON.parse(module.UTF8ToString(pointer)).filter((voice) =>
      voice.languages.some(
        (language) => language.name === "en" || language.name.startsWith("en-"),
      ),
    );
  } finally {
    module._free(pointer);
  }
}
