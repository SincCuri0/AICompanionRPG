/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Session, LiveServerMessage, Modality, StartSensitivity, EndSensitivity, SpeechConfig } from '@google/genai';

export interface DialogConfig {
  model: string;
  responseModalities: Modality[];
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: boolean;
      startOfSpeechSensitivity: StartSensitivity;
      endOfSpeechSensitivity: EndSensitivity;
    };
  };
  speechConfig: SpeechConfig;
}

export interface DialogServiceCallbacks {
  onopen: () => void;
  onmessage: (message: LiveServerMessage) => Promise<void>;
  onerror: (error: ErrorEvent) => void;
  onclose: (event: CloseEvent) => void;
}

export class DialogService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required to initialize DialogService.");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async connect(config: DialogConfig, callbacks: DialogServiceCallbacks): Promise<Session> {
    try {
      const session = await this.client.live.connect({
        model: config.model,
        callbacks: {
          onopen: callbacks.onopen,
          onmessage: callbacks.onmessage,
          onerror: callbacks.onerror,
          onclose: callbacks.onclose,
        },
        config: {
          responseModalities: config.responseModalities,
          realtimeInputConfig: config.realtimeInputConfig,
          speechConfig: config.speechConfig,
        },
      });
      return session;
    } catch (e) {
      console.error('Failed to connect dialog session:', e);
      throw e; // Re-throw to be handled by the caller
    }
  }

  sendRealtimeInput(session: Session, media: { data: string; mimeType: string }): void {
    if (session) { // Removed session.isOpen check
      session.sendRealtimeInput({ media });
    } else {
      console.warn('Session is not available. Cannot send realtime input.');
    }
  }

  sendClientContent(session: Session, content: { turns: string; turnComplete: boolean }): void {
    if (session) { // Removed session.isOpen check
      session.sendClientContent(content);
    } else {
      console.warn('Session is not available. Cannot send client content.');
    }
  }

  async closeSession(session: Session | null): Promise<void> {
    if (session) { // Removed session.isOpen check
      try {
        await session.close();
      } catch (e) {
        console.error('Error closing session:', e);
      }
    }
  }
}