/**
 * GenAILiveClient - Event-emitting class that manages Gemini Live API connection
 */

import {
  GoogleGenAI,
  LiveCallbacks,
  LiveConnectConfig,
  LiveServerMessage,
  Part,
} from "@google/genai";
import { EventEmitter } from "eventemitter3";
import { base64ToArrayBuffer } from "../utils/audioContext";

export interface LiveClientOptions {
  apiKey: string;
}

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: any) => void;
  error: (error: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: any) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: any) => void;
  toolcallcancellation: (toolCallCancellation: any) => void;
  turncomplete: () => void;
}

export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;
  private _session: any | null = null;
  private _status: "connected" | "disconnected" | "connecting" = "disconnected";

  public get status() {
    return this._status;
  }

  public get session() {
    return this._session;
  }

  constructor(options: LiveClientOptions) {
    super();
    this.client = new GoogleGenAI(options);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: any) {
    this.emit("log", {
      date: new Date(),
      type,
      message,
    });
  }

  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";

    const callbacks: LiveCallbacks = {
      onopen: (..._args) => {
        this.onopen();
      },
      onmessage: (message) => {
        this.onmessage(message);
      },
      onerror: (error) => {
        this.onerror(error);
      },
      onclose: (event) => {
        this.onclose(event);
      },
    };

    try {

      this._session = await this.client.live.connect({
        model,
        config,
        callbacks,
      });

      this._status = "connected";


      return true;
    } catch (e: any) {
      console.error("[Gemini Live] Error connecting to GenAI Live:", {
        error: e,
        message: e?.message,
        stack: e?.stack,
      });
      this._status = "disconnected";
      return false;
    }
  }

  public disconnect() {
    if (!this._session) {
      return false;
    }
    this._session?.close();
    this._session = null;
    this._status = "disconnected";
    this.log("client.close", `Disconnected`);
    return true;
  }

  protected onopen() {
    this.log("client.open", "Connected");
    this.emit("open");
  }

  protected onerror(e: ErrorEvent) {
    console.error('[Gemini Live] Error:', {
      message: e.message,
      error: e,
    });
    this.log("server.error", e.message);
    this.emit("error", e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this._status = "disconnected";
    this.emit("close", e);
  }

  protected async onmessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.log("server.send", "setupComplete");
      this.emit("setupcomplete");
      return;
    }
    if (message.toolCall) {
      this.log("server.toolCall", message);
      this.emit("toolcall", message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log("server.toolCallCancellation", message);
      this.emit("toolcallcancellation", message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;

      if ("interrupted" in serverContent) {
        this.log("server.content", "interrupted");
        this.emit("interrupted");
        return;
      }
      if ("turnComplete" in serverContent) {
        this.log("server.content", "turnComplete");
        this.emit("turncomplete");
      }

      if ("modelTurn" in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];

        // Extract audio parts
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm")
        );
        const base64s = audioParts.map((p) => p.inlineData?.data)

        // Strip audio parts out of modelTurn
        const otherParts = parts.filter(
          (p) => !(p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm"))
        );

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit("audio", data);
          }
        });

        if (otherParts.length > 0) {
          const content: { modelTurn: { parts: Part[] } } = {
            modelTurn: { parts: otherParts },
          };
          this.emit("content", content);
          this.log(`server.content`, message);
        }

      }
    } else {
      console.log("[Gemini Live] Received unmatched message:", message);
    }
  }

  /**
   * Send realtime input (audio/video chunks)
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this._session) {
      return;
    }

    for (const ch of chunks) {
      try {
        this._session.sendRealtimeInput({ media: ch });
      } catch (error: any) {
        console.error('[Gemini Live] Error sending chunk:', error?.message);
      }
    }
    // Skip logging realtime input to avoid flooding the event bus
  }

  /**
   * Send tool response
   */
  sendToolResponse(toolResponse: any) {
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this._session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log(`client.toolResponse`, toolResponse);
    }
  }

  /**
   * Send normal content parts (text)
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    this._session?.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, {
      turns: Array.isArray(parts) ? parts : [parts],
      turnComplete,
    });
  }
}
