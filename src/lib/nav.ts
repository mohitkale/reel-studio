import {
  LayoutDashboard,
  Clapperboard,
  AudioLines,
  LayoutTemplate,
  Library,
  ListVideo,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

/** Primary navigation. Single source of truth for the sidebar and route metadata. */
export const navItems: NavItem[] = [
  {
    title: "Projects",
    href: "/",
    icon: LayoutDashboard,
    description: "Your reel projects",
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
    title: "Assets",
    href: "/assets",
    icon: Library,
    description: "Images, Lottie, icons and avatars",
  },
  {
    title: "Renders",
    href: "/renders",
    icon: ListVideo,
    description: "Render queue and finished videos",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Voice providers, API keys and theme",
  },
];
