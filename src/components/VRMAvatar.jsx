import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, lerp } from "three/src/math/MathUtils.js";
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
  const targetBoneRotations = useAvatarControlStore(
    (state) => state.targetBoneRotations
  );
  const hasRemoteBonePose = Object.keys(targetBoneRotations).length > 0;

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

  useEffect(() => {
    if (!hasRemoteBonePose || !activeAction.current) return;

    // Full-body Mixamo clips write to the same humanoid bones every frame.
    // Remote granular pose control must win, so stop the active clip while a
    // bone pose target exists. A later triggerAnimation() clears bone targets
    // and starts the requested clip again.
    activeAction.current.stop();
    activeAction.current = null;
  }, [hasRemoteBonePose]);

  useFrame((_, delta) => {
    const vrm = userData.vrm;
    if (!vrm) return;

    // Expressions
    if (vrm.expressionManager) {
      Object.entries(targetExpressions).forEach(([name, value]) => {
        const currentValue = vrm.expressionManager.getValue(name) ?? 0;
        vrm.expressionManager.setValue(
          name,
          lerp(currentValue, value, delta * INTERPOLATION_SPEED)
        );
      });
    }

    // Bone rotations — targetBoneRotations is { [boneName]: { x?, y?, z? } } in degrees.
    // IMPORTANT: VRMHumanoid.update() transfers normalized bones to raw bones when
    // autoUpdateHumanBones is enabled, so remote pose control must target the
    // normalized bone first. If we rotate raw bones here, vrm.update(delta) can
    // immediately overwrite the pose and the gesture will not be visible.
    if (hasRemoteBonePose) {
      const humanoid = vrm.humanoid;
      Object.entries(targetBoneRotations).forEach(([boneName, axes]) => {
        // Prefer normalized bones because vrm.update() copies them to raw bones.
        let boneNode = humanoid.getNormalizedBoneNode?.(boneName);
        if (!boneNode) {
          boneNode = humanoid.getRawBoneNode?.(boneName);
        }
        if (!boneNode) return;

        const targetRad = {
          x: MathUtils.degToRad(axes.x ?? 0),
          y: MathUtils.degToRad(axes.y ?? 0),
          z: MathUtils.degToRad(axes.z ?? 0),
        };

        boneNode.rotation.x = lerp(boneNode.rotation.x, targetRad.x, delta * INTERPOLATION_SPEED);
        boneNode.rotation.y = lerp(boneNode.rotation.y, targetRad.y, delta * INTERPOLATION_SPEED);
        boneNode.rotation.z = lerp(boneNode.rotation.z, targetRad.z, delta * INTERPOLATION_SPEED);
      });
    }

    vrm.update(delta);
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
