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
- `avatar.bone.rotate` → `{ bone, axis, angle }` — angle en grados
- `avatar.bone.pose` → `{ pose: { [bone]: { x?, y?, z? } } }` — ángulos en grados

Todos incluyen `ts` para trazabilidad de latencia.

## Ejemplo: "Levanta el brazo derecho y gira la cabeza hacia la izquierda"

Llamada MCP:
```
set_body_pose({
  pose: {
    rightUpperArm: { x: -45 },
    head: { y: 30 }
  }
})
```

Esto envía por WebSocket:
```json
{ "type": "avatar.bone.pose", "pose": { "rightUpperArm": { "x": -45 }, "head": { "y": 30 } }, "ts": 1234567890 }
```

El frontend recibe el mensaje, actualiza `targetBoneRotations` en el store con grados, y `VRMAvatar.useFrame` convierte a radianes con `MathUtils.degToRad` antes de interpolar la rotación del hueso correspondiente.

Para gestos rápidos, el modelo debe usar `play_pose_sequence(frames)` en lugar de hacer muchas llamadas `rotate_body_part`. El servidor no trae gestos quemados: sólo reproduce los frames que el modelo genera, con `holdMs` por frame, y envía mensajes `avatar.bone.rotate`/`avatar.bone.pose` al broker local sin volver a consultar al LLM.

Nota importante: el frontend no reproduce `Idle` automáticamente al cargar. Las animaciones Mixamo siguen cargadas, pero sólo se activan con `trigger_animation(...)`. Cuando existe una pose granular (`targetBoneRotations` no vacío), el frontend detiene la animación Mixamo activa. Si no se hace esto, clips como `Idle` escriben sobre los mismos huesos cada frame y pisan el gesto remoto. Un `trigger_animation(...)` posterior limpia la pose manual y vuelve a reproducir la animación solicitada.

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
