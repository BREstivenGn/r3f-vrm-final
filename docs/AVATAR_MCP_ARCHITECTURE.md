# Arquitectura MCP + VRM en Tiempo Real

## Diagrama del sistema

```text
┌─────────────────────────────┐
│  Cliente MCP (LLM / Agent)  │
│  llama tools MCP            │
└──────────────┬──────────────┘
               │ stdio (MCP)
               ▼
┌──────────────────────────────────────────┐
│ mcp-vrm-control (../mcp-vrm-control)    │
│ - tools: expression / animation / speech│
│ - traduce a JSON compacto               │
│ - broadcast WebSocket a frontends       │
└──────────────┬───────────────────────────┘
               │ ws://localhost:8787
               ▼
┌──────────────────────────────────────────┐
│ Frontend React + R3F (este repo)        │
│ - hook WS escucha comandos              │
│ - Zustand guarda target state           │
│ - VRMAvatar aplica morphs y animaciones │
│ - render 3D local (latencia mínima)     │
└──────────────────────────────────────────┘
```

## Mensajes WebSocket (mínimos)

- `avatar.expression.set` → `{ emotion, intensity }`
- `avatar.animation.trigger` → `{ name }`
- `avatar.lipsync.visemes` → `{ visemes: [{ name, value }] }`
- `avatar.speech.request` → `{ text, voice }`

Todos incluyen `ts` para trazabilidad de latencia.

## Limpieza aplicada al frontend (qué conservar / qué sacar)

### Conservar (núcleo esencial)

- `src/components/VRMAvatar.jsx`
  - carga VRM
  - carga FBX y remap Mixamo→VRM
  - aplica expressionManager + animaciones
- `src/utils/remapMixamoAnimationToVrm.js`
- `src/utils/mixamoVRMRigMap.js`
- `src/components/Experience.jsx`
  - escena, luces, stage y avatar
- `public/models/**`
  - assets VRM/FBX/GLB

### Basura de demo desactivada en runtime (no esencial para control MCP)

- `src/components/UI.jsx` (overlay branding/demo)
- `src/components/CameraWidget.jsx` (tracking local MediaPipe)
- controles manuales de cámara (`CameraControls`) y panel Leva de selección manual

> Nota: Se dejó código legacy en el repo para rollback rápido, pero ya NO participa del flujo runtime principal.

## Hooks nuevos para control remoto

- `src/hooks/useAvatarControlStore.js`
  - estado objetivo del avatar (`targetAnimation`, `targetExpressions`)
  - estado de socket (`connected/disconnected/...`)
- `src/hooks/useAvatarWebSocket.js`
  - conexión WS nativa
  - parseo de mensajes y dispatch a store

## Flujo de baja latencia implementado

1. MCP tool call en servidor
2. serialización JSON mínima
3. `ws.send(...)` inmediato a clientes conectados
4. actualización de store en frontend
5. aplicación en `useFrame` con interpolación corta

## Próximo paso recomendado (si querés producción)

- Agregar pipeline TTS real (OpenAI, ElevenLabs, Azure, etc.) en `speak_and_lipsync` y enviar timing de visemas por frame.
- Añadir ACK opcional frontend→servidor para medir RTT y ajustar smoothing dinámico.
