import { describe, expect, it } from "vitest";

import {
  formatDictionary,
  normalizeForSpeech as say,
  numberToWords,
  parseDictionary,
  unspeakableCharacters,
} from "@/lib/speech-normalize";

describe("numbers, money and percentages", () => {
  it("writes whole numbers in words", () => {
    expect(numberToWords(0)).toBe("zero");
    expect(numberToWords(21)).toBe("twenty one");
    expect(numberToWords(1200)).toBe("one thousand two hundred");
    expect(numberToWords(2_500_000)).toBe("two million five hundred thousand");
  });

  it("says percentages and decimals", () => {
    expect(say("Up 15% this year")).toBe("Up fifteen percent this year");
    expect(say("Only 3.5% remain")).toBe(
      "Only three point five percent remain",
    );
  });

  it("says currencies, scales and singular amounts", () => {
    expect(say("It costs $5")).toBe("It costs five dollars");
    expect(say("Raised $1.5M")).toBe("Raised one point five million dollars");
    expect(say("Just $1 a day")).toBe("Just one dollar a day");
    expect(say("€20 and £3")).toBe("twenty euros and three pounds");
  });

  it("reads numbers with thousands commas as one number", () => {
    expect(say("1,200 people")).toBe("one thousand two hundred people");
    expect(say("In 2026")).toBe("In 2026");
  });
});

describe("dates, ordinals and units", () => {
  it("speaks ISO dates", () => {
    expect(say("On 2026-11-13 we ship")).toBe(
      "On November thirteenth, 2026 we ship",
    );
    expect(say("Version 2026-13-45")).toBe("Version 2026-13-45");
  });

  it("speaks ordinals", () => {
    expect(say("the 1st, 2nd and 21st")).toBe(
      "the first, second and twenty first",
    );
    expect(say("the 40th")).toBe("the fortieth");
  });

  it("speaks units with the right plural", () => {
    expect(say("Run 5km")).toBe("Run five kilometers");
    expect(say("1 kg of salt")).toBe("one kilogram of salt");
    expect(say("16 GB of memory")).toBe("sixteen gigabytes of memory");
  });
});

describe("links, handles, emoji and acronyms", () => {
  it("speaks addresses and handles", () => {
    expect(say("See https://www.example.com/path?x=1")).toBe(
      "See example dot com",
    );
    expect(say("Visit reelstudio.dev today")).toBe(
      "Visit reelstudio dot dev today",
    );
    expect(say("Follow @mohit now")).toBe("Follow at mohit now");
    expect(say("Use #Shorts")).toBe("Use hashtag Shorts");
  });

  it("removes emoji", () => {
    expect(say("Great job 🎉 team 👏")).toBe("Great job team");
  });

  it("spells acronyms but says the ones that are words", () => {
    expect(say("The API and the CPU")).toBe("The A P I and the C P U");
    expect(say("NASA and NATO")).toBe("NASA and NATO");
    expect(say("Two APIs")).toBe("Two A P Is");
    expect(say("World War III")).toBe("World War III");
  });
});

describe("pronunciation dictionary", () => {
  it("uses the bundled starter list", () => {
    expect(say("Learn SQL on GitHub")).toBe("Learn sequel on git hub");
  });

  it("lets the person's dictionary win and matches whole words only", () => {
    expect(
      say("Hyperframes is fast; hyperframesque is not", {
        dictionary: [{ find: "Hyperframes", replaceWith: "hyper frames" }],
      }),
    ).toBe("hyper frames is fast; hyperframesque is not");
    expect(
      say("SQL", { dictionary: [{ find: "SQL", replaceWith: "S Q L" }] }),
    ).toBe("S Q L");
  });

  it("prefers the longer phrase", () => {
    expect(say("PostgreSQL")).toBe("post-gres Q L");
  });

  it("parses and prints dictionary lines", () => {
    const rules = parseDictionary(
      "# comment\nKokoro = koh-koh-roh\n\nbad line\nnginx = engine X # trailing",
    );
    expect(rules).toEqual([
      { find: "Kokoro", replaceWith: "koh-koh-roh" },
      { find: "nginx", replaceWith: "engine X" },
    ]);
    expect(formatDictionary(rules)).toBe(
      "Kokoro = koh-koh-roh\nnginx = engine X",
    );
  });
});

describe("what a voice cannot say", () => {
  it("lists emoji and symbols", () => {
    expect(unspeakableCharacters("Hello 🎉 → done ©")).toEqual([
      "🎉",
      "→",
      "©",
    ]);
    expect(unspeakableCharacters("Plain words.")).toEqual([]);
  });

  it("is deterministic", () => {
    const text = "Raised $2M on 2026-11-13, up 40% — see example.com";
    expect(say(text)).toBe(say(text));
  });
});
