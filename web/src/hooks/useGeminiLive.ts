import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenAILiveClient, LiveClientOptions } from "../lib/genai-live-client";
import { AudioStreamer } from "../utils/audioStreamer";
import { audioContext } from "../utils/audioContext";
import VolMeterWorklet from "../lib/worklets/vol-meter";
import { LiveConnectConfig } from "@google/genai";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export function useGeminiLive(): UseLiveAPIResults {
  // Validate API key
  if (!GEMINI_API_KEY) {
    console.error("[Gemini Live Hook] VITE_GEMINI_API_KEY not set in environment variables");
  }

  const options: LiveClientOptions = useMemo(
    () => {
      if (!GEMINI_API_KEY) {
        console.warn("No API key provided");
      }
      return {
        apiKey: GEMINI_API_KEY || "",
      };
    },
    []
  );

  const client = useMemo(() => new GenAILiveClient(options), [options]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [model, setModel] = useState<string>("gemini-2.5-flash-native-audio-preview-12-2025");
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [connected, setConnected] = useState(false);
  const [_setupComplete, setSetupComplete] = useState(false);
  const [volume, setVolume] = useState(0);
  const intentionalDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorklet, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = (_event: CloseEvent) => {
      setConnected(false);
      setSetupComplete(false);

      // Auto-reconnect if the close was NOT intentional (i.e. timeout or server drop)
      if (!intentionalDisconnectRef.current) {
        console.warn('[Gemini Live Hook] Connection dropped unexpectedly. Attempting auto-reconnect in 1s...');
        reconnectTimerRef.current = setTimeout(async () => {
          try {
            if (config && Object.keys(config).length > 0) {
              // Reset status so connect() doesn't bail
              (client as any)._status = 'disconnected';
              (client as any)._session = null;
              const success = await client.connect(model, config);
              if (success) {
                console.log('[Gemini Live Hook] Auto-reconnect successful!');
              }
            }
          } catch (err) {
            console.error('[Gemini Live Hook] Auto-reconnect failed:', err);
          }
        }, 1000);
      }
    };

    const onError = (error: ErrorEvent) => {
      console.error("[Gemini Live Hook] Error:", error);
      setConnected(false);
      setSetupComplete(false);
    };

    const stopAudioStreamer = () => {
      audioStreamerRef.current?.stop();
    };

    const onAudio = (data: ArrayBuffer) => {
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));
    };

    const onSetupComplete = () => {
      setSetupComplete(true);
    };

    client
      .on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("setupcomplete", onSetupComplete);

    return () => {
      client
        .off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("setupcomplete", onSetupComplete);
      // Don't disconnect here - let the component handle it
    };
  }, [client]);

  const connect = useCallback(async () => {
    console.log("[Gemini Live Hook] Attempting to connect...", {
      hasConfig: !!config,
      model,
      configKeys: Object.keys(config),
    });

    if (!config || Object.keys(config).length === 0) {
      throw new Error("config has not been set");
    }

    intentionalDisconnectRef.current = false;

    // Disconnect first if already connected
    if (client.status === "connected") {
      client.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const success = await client.connect(model, config);
    if (success) {
    } else {
      throw new Error("Failed to connect to Gemini Live API");
    }
  }, [client, config, model]);

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    connect,
    disconnect,
    volume,
  };
}
