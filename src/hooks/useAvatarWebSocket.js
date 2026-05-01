import { useEffect } from "react";
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

export const useAvatarWebSocket = () => {
  const setSocketStatus = useAvatarControlStore((state) => state.setSocketStatus);
  const triggerAnimation = useAvatarControlStore((state) => state.triggerAnimation);
  const setExpression = useAvatarControlStore((state) => state.setExpression);
  const setExpressions = useAvatarControlStore((state) => state.setExpressions);

  useEffect(() => {
    let ws;
    let retryTimer;
    let stopped = false;

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
        }
        } catch {
          // Ignore malformed messages to keep render loop stable.
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [setExpression, setExpressions, setSocketStatus, triggerAnimation]);
};
