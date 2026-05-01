import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { lerp } from "three/src/math/MathUtils.js";
import { useAvatarControlStore } from "../hooks/useAvatarControlStore";
import { remapMixamoAnimationToVrm } from "../utils/remapMixamoAnimationToVrm";

const INTERPOLATION_SPEED = 12;

export const VRMAvatar = ({ avatar, ...props }) => {
  const { scene, userData } = useGLTF(
    `models/${avatar}`,
    undefined,
    undefined,
    (loader) => {
      loader.register((parser) => new VRMLoaderPlugin(parser));
    }
  );

  const assetSwing = useFBX("models/animations/Swing Dancing.fbx");
  const assetThriller = useFBX("models/animations/Thriller Part 2.fbx");
  const assetIdle = useFBX("models/animations/Breathing Idle.fbx");

  const currentVrm = userData.vrm;

  const animationClipSwing = useMemo(() => {
    const clip = remapMixamoAnimationToVrm(currentVrm, assetSwing);
    clip.name = "Swing Dancing";
    return clip;
  }, [assetSwing, currentVrm]);

  const animationClipThriller = useMemo(() => {
    const clip = remapMixamoAnimationToVrm(currentVrm, assetThriller);
    clip.name = "Thriller Part 2";
    return clip;
  }, [assetThriller, currentVrm]);

  const animationClipIdle = useMemo(() => {
    const clip = remapMixamoAnimationToVrm(currentVrm, assetIdle);
    clip.name = "Idle";
    return clip;
  }, [assetIdle, currentVrm]);

  const { actions } = useAnimations(
    [animationClipSwing, animationClipThriller, animationClipIdle],
    currentVrm?.scene
  );

  const targetAnimation = useAvatarControlStore((state) => state.targetAnimation);
  const targetExpressions = useAvatarControlStore(
    (state) => state.targetExpressions
  );

  const activeAction = useRef(null);

  useEffect(() => {
    const vrm = userData.vrm;
    if (!vrm) return;

    VRMUtils.removeUnnecessaryVertices(scene);
    VRMUtils.combineSkeletons(scene);
    VRMUtils.combineMorphs(vrm);

    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
  }, [scene, userData.vrm]);

  useEffect(() => {
    if (!actions || !targetAnimation) return;

    const nextAction = actions[targetAnimation];
    if (!nextAction) return;

    if (activeAction.current && activeAction.current !== nextAction) {
      activeAction.current.fadeOut(0.12);
    }

    nextAction.reset().fadeIn(0.12).play();
    activeAction.current = nextAction;
  }, [actions, targetAnimation]);

  useFrame((_, delta) => {
    if (!userData.vrm?.expressionManager) return;

    Object.entries(targetExpressions).forEach(([name, value]) => {
      const currentValue = userData.vrm.expressionManager.getValue(name) ?? 0;
      userData.vrm.expressionManager.setValue(
        name,
        lerp(currentValue, value, delta * INTERPOLATION_SPEED)
      );
    });

    userData.vrm.update(delta);
  });

  return (
    <group {...props}>
      <primitive
        object={scene}
        rotation-y={avatar !== "3636451243928341470.vrm" ? Math.PI : 0}
      />
    </group>
  );
};
