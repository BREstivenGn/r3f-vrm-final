import { useEffect, useRef } from "react";
import { useAvatarControlStore } from "./useAvatarControlStore";

const WS_URL = import.meta.env.VITE_AVATAR_WS_URL ?? "ws://localhost:8787";

const normalizeExpressionName = (emotion) => {
  if (!emotion) return null;
  const key = emotion.toLowerCase();
  if (key === "joy") return "happy";
  if (key === "mouthopen" || key === "mouth_open") return "aa";
  return emotion;
};

const normalizeAnimationName = (name) => {
  if (!name) return null;
  const key = name.toLowerCase();
  if (key === "wave" || key === "saludo") return "Swing Dancing";
  if (key === "idle") return "Idle";
  return name;
};

const clonePose = (pose = {}) =>
  Object.fromEntries(
    Object.entries(pose).map(([bone, axes]) => [bone, { ...axes }])
  );

const buildRelativePose = (basePose, pose = {}) => {
  const next = {};
  Object.entries(pose).forEach(([bone, axes]) => {
    next[bone] = {};
    Object.entries(axes).forEach(([axis, value]) => {
      next[bone][axis] = (basePose[bone]?.[axis] ?? 0) + value;
    });
  });
  return next;
};

const buildRelativeSingleBonePose = (basePose, bone, axis, angle) => ({
  [bone]: {
    [axis]: (basePose[bone]?.[axis] ?? 0) + angle,
  },
});

export const useAvatarWebSocket = () => {
  const sequenceTimers = useRef([]);

  const setSocketStatus = useAvatarControlStore((state) => state.setSocketStatus);
  const triggerAnimation = useAvatarControlStore((state) => state.triggerAnimation);
  const setExpression = useAvatarControlStore((state) => state.setExpression);
  const setExpressions = useAvatarControlStore((state) => state.setExpressions);
  const rotateBoneTarget = useAvatarControlStore((state) => state.rotateBoneTarget);
  const setBonePose = useAvatarControlStore((state) => state.setBonePose);

  useEffect(() => {
    let ws;
    let retryTimer;
    let stopped = false;

    const clearSequenceTimers = () => {
      sequenceTimers.current.forEach((timer) => clearTimeout(timer));
      sequenceTimers.current = [];
    };

    const schedulePoseSequence = ({ mode = "absolute", frames = [] }) => {
      clearSequenceTimers();

      const basePose = clonePose(
        useAvatarControlStore.getState().targetBoneRotations
      );
      let elapsed = 0;

      frames.forEach((frame) => {
        const timer = setTimeout(() => {
          if (frame.pose) {
            setBonePose(
              mode === "relative"
                ? buildRelativePose(basePose, frame.pose)
                : frame.pose
            );
          }

          if (frame.bone && frame.axis && typeof frame.angle === "number") {
            if (mode === "relative") {
              setBonePose(
                buildRelativeSingleBonePose(
                  basePose,
                  frame.bone,
                  frame.axis,
                  frame.angle
                )
              );
            } else {
              rotateBoneTarget(frame.bone, frame.axis, frame.angle);
            }
          }
        }, elapsed);

        sequenceTimers.current.push(timer);
        elapsed += Math.max(0, frame.holdMs ?? 80);
      });
    };

    const connect = () => {
      if (stopped) return;
      setSocketStatus("connecting");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setSocketStatus("connected");
      };

      ws.onclose = () => {
        if (stopped) return;
        setSocketStatus("disconnected");
        retryTimer = setTimeout(connect, 1000);
      };

      ws.onerror = () => {
        setSocketStatus("error");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "avatar.animation.trigger") {
            const animationName = normalizeAnimationName(message.name);
            if (animationName) {
              triggerAnimation(animationName);
            }
            return;
          }

          if (message.type === "avatar.expression.set") {
            const normalized = normalizeExpressionName(message.emotion);
            if (normalized) {
              setExpression(normalized, message.intensity ?? 0);
            }
            return;
          }

          if (message.type === "avatar.lipsync.visemes") {
            const patch = {};
            for (const viseme of message.visemes ?? []) {
              if (!viseme?.name) continue;
              patch[viseme.name] = viseme.value ?? 0;
            }
            if (Object.keys(patch).length > 0) {
              setExpressions(patch);
            }
            return;
          }

          if (message.type === "avatar.lipsync.mouth") {
            setExpression("aa", message.mouth ?? 0);
            return;
          }

          if (message.type === "avatar.bone.rotate") {
            rotateBoneTarget(message.bone, message.axis, message.angle ?? 0);
            return;
          }

          if (message.type === "avatar.bone.pose") {
            setBonePose(message.pose ?? {});
            return;
          }

          if (message.type === "avatar.pose.sequence") {
            schedulePoseSequence({
              mode: message.mode ?? "absolute",
              frames: message.frames ?? [],
            });
          }
        } catch {
          // Ignore malformed messages to keep render loop stable.
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      clearSequenceTimers();
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [
    setExpression,
    setExpressions,
    setSocketStatus,
    triggerAnimation,
    rotateBoneTarget,
    setBonePose,
  ]);
};
