import { create } from "zustand";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const DEFAULT_EXPRESSIONS = {
  aa: 0,
  ih: 0,
  ee: 0,
  oh: 0,
  ou: 0,
  blinkLeft: 0,
  blinkRight: 0,
  angry: 0,
  sad: 0,
  happy: 0,
};

export const useAvatarControlStore = create((set) => ({
  socketStatus: "disconnected",
  targetAnimation: "Idle",
  targetExpressions: { ...DEFAULT_EXPRESSIONS },

  setSocketStatus: (socketStatus) => set({ socketStatus }),

  triggerAnimation: (targetAnimation) => set({ targetAnimation }),

  setExpression: (name, value) =>
    set((state) => ({
      targetExpressions: {
        ...state.targetExpressions,
        [name]: clamp01(value),
      },
    })),

  setExpressions: (patch) =>
    set((state) => {
      const next = { ...state.targetExpressions };
      Object.entries(patch).forEach(([key, value]) => {
        next[key] = clamp01(value);
      });
      return { targetExpressions: next };
    }),

  resetExpressions: () => set({ targetExpressions: { ...DEFAULT_EXPRESSIONS } }),
}));
