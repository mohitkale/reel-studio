"use client";

import * as React from "react";

import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  getMotionRecipe,
  getStyleChrome,
  getTransitionFrames,
  type EnergyId,
  type MotionRecipe,
  type StyleChrome,
  type StyleId,
  type TransitionRecipe,
} from "../visual-style";

export interface VisualStyleContextValue {
  styleId: StyleId;
  energy: EnergyId;
  chrome: StyleChrome;
  motion: MotionRecipe;
  transition: TransitionRecipe;
  transitionFrames: number;
}

const VisualStyleContext = React.createContext<VisualStyleContextValue>({
  styleId: DEFAULT_STYLE_ID,
  energy: DEFAULT_ENERGY_ID,
  chrome: getStyleChrome(DEFAULT_STYLE_ID),
  motion: getMotionRecipe(DEFAULT_STYLE_ID, DEFAULT_ENERGY_ID),
  transition: getStyleChrome(DEFAULT_STYLE_ID).transition,
  transitionFrames: getTransitionFrames(DEFAULT_STYLE_ID, DEFAULT_ENERGY_ID),
});

export function useVisualStyle() {
  return React.useContext(VisualStyleContext);
}

export function VisualStyleProvider({
  styleId = DEFAULT_STYLE_ID,
  energy = DEFAULT_ENERGY_ID,
  fps = 30,
  children,
}: {
  styleId?: StyleId;
  energy?: EnergyId;
  fps?: number;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => {
    const chrome = getStyleChrome(styleId);
    return {
      styleId,
      energy,
      chrome,
      motion: getMotionRecipe(styleId, energy),
      transition: chrome.transition,
      transitionFrames: getTransitionFrames(styleId, energy, fps),
    };
  }, [styleId, energy, fps]);

  return (
    <VisualStyleContext.Provider value={value}>{children}</VisualStyleContext.Provider>
  );
}
