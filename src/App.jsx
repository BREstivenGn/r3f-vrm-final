import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "./components/Experience";
import { useAvatarControlStore } from "./hooks/useAvatarControlStore";
import { useAvatarWebSocket } from "./hooks/useAvatarWebSocket";

const ConnectionBadge = () => {
  const socketStatus = useAvatarControlStore((state) => state.socketStatus);
  return (
    <div className="fixed left-4 top-4 z-50 rounded bg-black/70 px-3 py-2 text-xs text-white">
      Avatar WS: {socketStatus}
    </div>
  );
};

function App() {
  useAvatarWebSocket();

  return (
    <>
      <ConnectionBadge />
      <Loader />
      <Canvas shadows camera={{ position: [0.25, 0.25, 2], fov: 30 }}>
        <color attach="background" args={["#333"]} />
        <fog attach="fog" args={["#333", 10, 20]} />
        <Suspense>
          <Experience />
        </Suspense>
      </Canvas>
    </>
  );
}

export default App;
