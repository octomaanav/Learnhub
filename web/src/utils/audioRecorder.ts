import EventEmitter from "eventemitter3";
import { createAudioContext, arrayBufferToBase64 } from "./audioContext";
import { AudioRecordingWorklet } from "./audioWorklets";

export class AudioRecorder extends EventEmitter {
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private recordingWorklet?: AudioWorkletNode;
  public recording = false;
  public sampleRate: number;

  constructor(sampleRate = 16000) {
    super();
    this.sampleRate = sampleRate;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia not supported");
    }

    // 1. Get microphone stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2. Create AudioContext
    this.audioContext = await createAudioContext({ sampleRate: this.sampleRate });

    // 3. Create source node
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // 4. Create worklet
    const workletBlob = new Blob([AudioRecordingWorklet], {
      type: "application/javascript",
    });
    const workletUrl = URL.createObjectURL(workletBlob);

    await this.audioContext.audioWorklet.addModule(workletUrl);
    this.recordingWorklet = new AudioWorkletNode(
      this.audioContext,
      "audio-recorder-worklet"
    );

    // 5. Listen for audio chunks
    this.recordingWorklet.port.onmessage = (ev: MessageEvent) => {
      const arrayBuffer = ev.data.data?.int16arrayBuffer;
      if (arrayBuffer) {
        const base64 = arrayBufferToBase64(arrayBuffer);
        this.emit("data", base64);
      }
    };

    // 6. Connect source to worklet
    this.source.connect(this.recordingWorklet);
    this.recording = true;

    URL.revokeObjectURL(workletUrl);
  }

  stop() {
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    // Close the AudioContext so a fresh one (with a new worklet scope) is created on next start()
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => { });
    }
    this.stream = undefined;
    this.audioContext = undefined;
    this.source = undefined;
    this.recordingWorklet = undefined;
    this.recording = false;
  }
}
