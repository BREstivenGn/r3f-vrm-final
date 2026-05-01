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

// Relaxed startup pose (degrees) to avoid rigid T-pose look.
const DEFAULT_BONE_ROTATIONS = {
  // Arms hanging down at body sides (neutral/rest-like stance)
  leftUpperArm: { z: 68 },
  rightUpperArm: { z: -68 },
  leftLowerArm: { z: 8 },
  rightLowerArm: { z: -8 },
  leftShoulder: { z: 6 },
  rightShoulder: { z: -6 },
  // Slight wrist relaxation
  leftHand: { x: 6, z: 4 },
  rightHand: { x: 6, z: -4 },
  // Natural finger curl (not fully straight)
  leftIndexProximal: { x: 12 },
  leftIndexIntermediate: { x: 16 },
  leftIndexDistal: { x: 10 },
  leftMiddleProximal: { x: 14 },
  leftMiddleIntermediate: { x: 18 },
  leftMiddleDistal: { x: 12 },
  leftRingProximal: { x: 16 },
  leftRingIntermediate: { x: 20 },
  leftRingDistal: { x: 14 },
  leftLittleProximal: { x: 18 },
  leftLittleIntermediate: { x: 22 },
  leftLittleDistal: { x: 16 },
  rightIndexProximal: { x: 12 },
  rightIndexIntermediate: { x: 16 },
  rightIndexDistal: { x: 10 },
  rightMiddleProximal: { x: 14 },
  rightMiddleIntermediate: { x: 18 },
  rightMiddleDistal: { x: 12 },
  rightRingProximal: { x: 16 },
  rightRingIntermediate: { x: 20 },
  rightRingDistal: { x: 14 },
  rightLittleProximal: { x: 18 },
  rightLittleIntermediate: { x: 22 },
  rightLittleDistal: { x: 16 },
  leftThumbProximal: { y: -10, z: 8 },
  leftThumbIntermediate: { y: -6, z: 6 },
  leftThumbDistal: { y: -4, z: 4 },
  rightThumbProximal: { y: 10, z: -8 },
  rightThumbIntermediate: { y: 6, z: -6 },
  rightThumbDistal: { y: 4, z: -4 },
  neck: { x: 1 },
};

export const useAvatarControlStore = create((set) => ({
  socketStatus: "disconnected",
  // No autoplay: keep Mixamo clips loaded, but only play one after an explicit
  // avatar.animation.trigger command. This prevents the default Idle clip from
  // reapplying itself and fighting manual bone poses.
  targetAnimation: null,
  targetExpressions: { ...DEFAULT_EXPRESSIONS },

  setSocketStatus: (socketStatus) => set({ socketStatus }),

  triggerAnimation: (targetAnimation) =>
    set({ targetAnimation, targetBoneRotations: {} }),

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

  // Bone rotation state — angles stored in degrees for clarity at the API boundary.
  // The store holds the target; VRMAvatar converts to radians when applying.
  targetBoneRotations: { ...DEFAULT_BONE_ROTATIONS },

  /**
   * Merge a single-axis rotation into an existing bone target.
   * @param {string} bone - normalized VRM bone name
   * @param {"x"|"y"|"z"} axis
   * @param {number} angleDegrees
   */
  rotateBoneTarget: (bone, axis, angleDegrees) =>
    set((state) => ({
      targetBoneRotations: {
        ...state.targetBoneRotations,
        [bone]: { ...state.targetBoneRotations[bone], [axis]: angleDegrees },
      },
    })),

  /**
   * Merge a full pose (multiple bones + axes) into the current bone targets.
   * @param {Record<string,{x?:number,y?:number,z?:number}>} pose
   */
  setBonePose: (pose) =>
    set((state) => {
      const next = { ...state.targetBoneRotations };
      Object.entries(pose).forEach(([bone, axes]) => {
        next[bone] = { ...next[bone], ...axes };
      });
      return { targetBoneRotations: next };
    }),

  resetBonePose: () => set({ targetBoneRotations: { ...DEFAULT_BONE_ROTATIONS } }),
}));
