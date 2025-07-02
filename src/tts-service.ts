/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from '@google/genai';

export interface TTSConfig {
  voiceName: string;
  responseModalities?: Modality[];
}

export class TTSService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required to initialize TTSService.");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateSpeech(text: string, config: TTSConfig): Promise<ArrayBuffer | null> {
    const startTime = performance.now();
    try {
      console.log(`[TTS] ${new Date().toISOString()} - Starting speech generation for text (${text.length} chars) with voice: ${config.voiceName}`);
      
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: config.voiceName },
            },
          },
        },
      });

      const apiTime = performance.now();
      console.log(`[TTS] ${new Date().toISOString()} - API response received after ${((apiTime - startTime) / 1000).toFixed(2)}s:`, {
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length,
        hasContent: !!response.candidates?.[0]?.content,
        partsLength: response.candidates?.[0]?.content?.parts?.length
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (audioData) {
        const conversionStartTime = performance.now();
        console.log(`[TTS] ${new Date().toISOString()} - PCM audio data received: ${audioData.length} characters`);
        
        // Convert base64 to ArrayBuffer for PCM processing
        const binaryString = atob(audioData);
        const arrayBuffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        const conversionTime = performance.now();
        console.log(`[TTS] ${new Date().toISOString()} - Converted to ArrayBuffer: ${arrayBuffer.byteLength} bytes in ${((conversionTime - conversionStartTime) / 1000).toFixed(3)}s`);
        console.log(`[TTS] ${new Date().toISOString()} - Total generation time: ${((conversionTime - startTime) / 1000).toFixed(2)}s`);
        return arrayBuffer;
      } else {
        console.warn('[TTS] No audio data in response');
        return null;
      }
      
    } catch (error) {
      console.error('TTS generation failed:', error);
      throw error;
    }
  }

  async playPCMAudio(pcmArrayBuffer: ArrayBuffer): Promise<void> {
    const playbackStartTime = performance.now();
    console.log(`[TTS] ${new Date().toISOString()} - Starting PCM audio playback: ${pcmArrayBuffer.byteLength} bytes`);
    
    // Create audio context with proper sample rate for TTS
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Gemini TTS typically uses 24kHz
    });
    
    try {
      // PCM data from Gemini TTS is typically:
      // - 16-bit signed integers
      // - 24kHz sample rate  
      // - Single channel (mono)
      
      const sampleRate = 24000;
      const channels = 1;
      const bytesPerSample = 2; // 16-bit = 2 bytes
      const numSamples = pcmArrayBuffer.byteLength / bytesPerSample;
      
      const bufferCreationStart = performance.now();
      console.log(`[TTS] ${new Date().toISOString()} - PCM format: ${sampleRate}Hz, ${channels} channel(s), ${numSamples} samples`);
      
      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(channels, numSamples, sampleRate);
      
      // Convert PCM data to float array
      const dataView = new DataView(pcmArrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < numSamples; i++) {
        // Read 16-bit signed integer and convert to float (-1 to 1)
        const sample = dataView.getInt16(i * 2, true); // true = little endian
        channelData[i] = sample / 32768.0; // Convert to -1.0 to 1.0 range
      }
      
      const bufferCreationTime = performance.now();
      console.log(`[TTS] ${new Date().toISOString()} - Audio buffer created: ${audioBuffer.duration.toFixed(2)}s duration in ${((bufferCreationTime - bufferCreationStart) / 1000).toFixed(3)}s`);
      
      // Create source and play
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      return new Promise((resolve, reject) => {
        source.onended = () => {
          const playbackEndTime = performance.now();
          console.log(`[TTS] ${new Date().toISOString()} - Audio playback completed after ${((playbackEndTime - playbackStartTime) / 1000).toFixed(2)}s`);
          audioContext.close();
          resolve();
        };
        
        const actualPlayStart = performance.now();
        console.log(`[TTS] ${new Date().toISOString()} - Starting audio playback (setup took ${((actualPlayStart - playbackStartTime) / 1000).toFixed(3)}s)`);
        source.start(0);
      });
      
    } catch (error) {
      audioContext.close();
      console.error('[TTS] PCM audio playback failed:', error);
      throw error;
    }
  }

  async speakText(text: string, voiceName: string): Promise<void> {
    const pcmData = await this.generateSpeech(text, { voiceName });
    
    if (pcmData) {
      await this.playPCMAudio(pcmData);
    } else {
      throw new Error('No audio generated');
    }
  }
}