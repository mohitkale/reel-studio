import {
  Clapperboard,
  Mic,
  AudioLines,
  LayoutTemplate,
  Images,
  Library,
  Palette,
  ListVideo,
  Settings,
  Sparkles,
  Film,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const create: NavItem = {
  title: "Create",
  href: "/",
  icon: Sparkles,
  description: "Describe a video and get it made",
};
const library: NavItem = {
  title: "Library",
  href: "/library",
  icon: Film,
  description: "All your videos, with filters",
};
const podcasts: NavItem = {
  title: "Podcasts",
  href: "/podcasts",
  icon: Mic,
  description: "Voice-only multi-speaker podcasts",
};
const brand: NavItem = {
  title: "Brand",
  href: "/brand-kits",
  icon: Palette,
  description: "Brand kits and uploaded images",
};
const settings: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Voice, AI writer, checks and mode",
};

/** Simple mode: five destinations, nothing else. */
export const simpleNavItems: NavItem[] = [
  create,
  library,
  podcasts,
  brand,
  settings,
];

/**
 * Pro mode: the five above plus every manual workspace, unchanged in function.
 * Existing installs open here so nobody loses their workspace.
 */
export const proNavItems: NavItem[] = [
  create,
  library,
  podcasts,
  {
    title: "Voiceovers",
    href: "/voiceovers",
    icon: AudioLines,
    description: "Narration and audio-only videos",
  },
  {
    title: "Batches",
    href: "/factory",
    icon: ListVideo,
    description: "Masters, review and derived outputs",
  },
  {
    title: "Editor",
    href: "/editor",
    icon: Clapperboard,
    description: "Write scripts and compose scenes",
  },
  {
    title: "Voices",
    href: "/voices",
    icon: AudioLines,
    description: "Browse and preview provider voices",
  },
  {
    title: "Templates",
    href: "/templates",
    icon: LayoutTemplate,
    description: "Premium animated scene templates",
  },
  {
    title: "Gallery",
    href: "/gallery",
    icon: Images,
    description: "Reproducible examples and ready-made looks",
  },
  {
    title: "Assets",
    href: "/assets",
    icon: Library,
    description: "Images, Lottie, icons and avatars",
  },
  brand,
  {
    title: "Exports",
    href: "/renders",
    icon: ListVideo,
    description: "Export queue and finished videos",
  },
  settings,
];

export function navForMode(mode: "simple" | "pro"): NavItem[] {
  return mode === "pro" ? proNavItems : simpleNavItems;
}

/** Every destination in either mode, for page titles. */
export const navItems: NavItem[] = [...proNavItems];

/** Pages that belong to a nav item without being its href (so it stays highlighted). */
export const navAliases: Record<string, string[]> = {
  "/brand-kits": ["/assets"],
  "/": ["/examples", "/results", "/scenes"],
  "/settings": ["/diagnostics"],
};

function owns(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

/** Active when the page is the item's own, or an alias no other item in the list owns. */
export function isNavActive(
  pathname: string,
  item: NavItem,
  items: NavItem[],
): boolean {
  if (owns(pathname, item.href)) return true;
  if (items.some((other) => owns(pathname, other.href))) return false;
  return (navAliases[item.href] ?? []).some((href) => owns(pathname, href));
}
