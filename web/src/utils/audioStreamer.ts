/**
 * AudioStreamer - Plays PCM16 audio chunks through Web Audio API
 */
type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(this: MessagePort, ev: MessageEvent) => any>;
};

const registeredWorklets: Map<AudioContext, Record<string, WorkletGraph>> = new Map();

const createWorkletFromSrc = (workletName: string, workletSrc: string) => {
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: "application/javascript",
    },
  );
  return URL.createObjectURL(script);
};

export class AudioStreamer {
  private sampleRate: number = 24000;
  private bufferSize: number = 7680;
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private scheduledTime: number = 0;
  private initialBufferTime: number = 0.1; // 100ms initial buffer
  private gainNode: GainNode;
  private checkInterval: number | null = null;
  private endOfQueueAudioSource: AudioBufferSourceNode | null = null;
  public context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
  }

  async addWorklet<T extends (d: any) => void>(
    workletName: string,
    workletSrc: string,
    handler: T
  ): Promise<this> {
    let workletsRecord = registeredWorklets.get(this.context);
    if (workletsRecord && workletsRecord[workletName]) {
      workletsRecord[workletName].handlers.push(handler);
      return Promise.resolve(this);
    }

    if (!workletsRecord) {
      registeredWorklets.set(this.context, {});
      workletsRecord = registeredWorklets.get(this.context)!;
    }

    workletsRecord[workletName] = { handlers: [handler] };

    const src = createWorkletFromSrc(workletName, workletSrc);
    await this.context.audioWorklet.addModule(src);
    const worklet = new AudioWorkletNode(this.context, workletName);

    workletsRecord[workletName].node = worklet;

    URL.revokeObjectURL(src);
    return this;
  }

  /**
   * Converts PCM16 (Int16) to Float32
   */
  private processPCM16Chunk(chunk: Uint8Array): Float32Array {
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error("[AudioStreamer] Error processing PCM16 chunk:", e);
      }
    }
    return float32Array;
  }

  /**
   * Add PCM16 audio chunk for playback
   */
  addPCM16(chunk: Uint8Array) {
    if (this.context.state === 'suspended') {
      this.context.resume().catch(e => console.error("[AudioStreamer] Resume error:", e));
    }

    // Ensure volume is up - cancel any ongoing ramp to 0 from stop()
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.setTargetAtTime(1, this.context.currentTime, 0.01);

    let processingBuffer = this.processPCM16Chunk(chunk);

    // Split into smaller buffers
    while (processingBuffer.length >= this.bufferSize) {
      const buffer = processingBuffer.slice(0, this.bufferSize);
      this.audioQueue.push(buffer);
      processingBuffer = processingBuffer.slice(this.bufferSize);
    }
    if (processingBuffer.length > 0) {
      this.audioQueue.push(processingBuffer);
    }

    // Start playing if not already
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.scheduledTime = this.context.currentTime + this.initialBufferTime;
      console.log(`[AudioStreamer] 🔈 Start playing. Context time: ${this.context.currentTime.toFixed(3)}, Scheduled: ${this.scheduledTime.toFixed(3)}, Queue: ${this.audioQueue.length}`);
      this.scheduleNextBuffer();
    }
  }

  private scheduleNextBuffer() {
    const SCHEDULE_AHEAD_TIME = 0.2;

    while (
      this.audioQueue.length > 0 &&
      this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME
    ) {
      const audioData = this.audioQueue.shift()!;
      const audioBuffer = this.context.createBuffer(
        1,
        audioData.length,
        this.sampleRate
      );
      audioBuffer.getChannelData(0).set(audioData);

      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Connect to worklets if any (just for analysis, don't connect node to destination)
      const worklets = registeredWorklets.get(this.context);
      if (worklets) {
        Object.entries(worklets).forEach(([_workletName, graph]) => {
          const { node, handlers } = graph;
          if (node) {
            source.connect(node);
            node.port.onmessage = function (ev: MessageEvent) {
              handlers.forEach((handler) => {
                handler.call(node.port, ev);
              });
            };
            // Note: node NOT connected to destination to avoid double routing or interference
          }
        });
      }

      if (this.audioQueue.length === 0) {
        if (this.endOfQueueAudioSource) {
          this.endOfQueueAudioSource.onended = null;
        }
        this.endOfQueueAudioSource = source;
        source.onended = () => {
          if (
            !this.audioQueue.length &&
            this.endOfQueueAudioSource === source
          ) {
            this.endOfQueueAudioSource = null;
          }
        };
      }

      const startTime = Math.max(
        this.scheduledTime,
        this.context.currentTime
      );

      // Check for silence/signal
      let maxAmp = 0;
      for (let i = 0; i < Math.min(audioData.length, 1000); i++) {
        const abs = Math.abs(audioData[i]);
        if (abs > maxAmp) maxAmp = abs;
      }

      if (maxAmp > 0) {
        console.log(`[AudioStreamer] 🔊 SCHEDULING buffer: contextTime=${this.context.currentTime.toFixed(3)}, startTime=${startTime.toFixed(3)}, duration=${audioBuffer.duration.toFixed(3)}, maxAmp=${maxAmp.toFixed(4)}`);
      } else {
        console.warn(`[AudioStreamer] 🔈 SCHEDULING SILENT buffer: contextTime=${this.context.currentTime.toFixed(3)}, startTime=${startTime.toFixed(3)}`);
      }

      source.start(startTime);
      this.scheduledTime = startTime + audioBuffer.duration;
    }

    if (this.audioQueue.length > 0) {
      const nextCheckTime =
        (this.scheduledTime - this.context.currentTime) * 1000;
      setTimeout(
        () => this.scheduleNextBuffer(),
        Math.max(0, nextCheckTime - 50)
      );
    } else {
      this.isPlaying = false;
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  }

  stop() {
    this.isPlaying = false;
    this.audioQueue = [];
    this.scheduledTime = this.context.currentTime;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Duck volume quickly
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
  }
}
