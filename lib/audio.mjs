// Local WebSocket runtimes can deliver binary messages as Blob or ArrayBuffer.
// Normalize before forwarding; passing a Blob to send() can become text.
export async function normalizeAudioFrame(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
  if (value instanceof Blob) return value.arrayBuffer();
  throw new TypeError("Expected binary audio.");
}
