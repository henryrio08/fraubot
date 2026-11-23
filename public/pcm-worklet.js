class PCMProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.pending = []; this.position = 0; }
  process(inputs) {
    const input = inputs[0]?.[0]; if (!input) return true;
    this.pending.push(...input);
    const ratio = sampleRate / 24000;
    if (this.pending.length >= sampleRate * .08) {
      const out = [];
      while (this.position + 1 < this.pending.length) {
        const index = Math.floor(this.position); const fraction = this.position - index;
        const value = this.pending[index] * (1 - fraction) + this.pending[index + 1] * fraction;
        out.push(Math.max(-32768, Math.min(32767, Math.round(value * (value < 0 ? 32768 : 32767)))));
        this.position += ratio;
      }
      const consumed = Math.floor(this.position); this.pending.splice(0, consumed); this.position -= consumed;
      const buffer = new ArrayBuffer(out.length * 2); const view = new DataView(buffer);
      out.forEach((value, i) => view.setInt16(i * 2, value, true)); this.port.postMessage(buffer, [buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-stream", PCMProcessor);
