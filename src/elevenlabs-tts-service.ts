/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ElevenLabsTTSConfig {
  voiceName?: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
}

export class ElevenLabsTTSService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("ElevenLabs API key is required to initialize ElevenLabsTTSService.");
    }
    this.apiKey = apiKey;
  }

  async generateSpeech(text: string, config: ElevenLabsTTSConfig): Promise<ArrayBuffer | null> {
    const startTime = performance.now();
    try {
      const voiceIdentifier = config.voiceId || config.voiceName || 'Puck';
      console.log(`[ElevenLabs] ${new Date().toISOString()} - Starting speech generation for text (${text.length} chars) with voice: ${voiceIdentifier}`);
      
      // Use provided voiceId directly
      const voiceId = config.voiceId;
      console.log(`[ElevenLabs] Final voiceId being used for API call: "${voiceId}"`);
      
      if (!voiceId) {
        throw new Error('No voice ID available for ElevenLabs API call');
      }
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${config.outputFormat || 'mp3_44100_128'}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { 
            stability: 0.5, 
            similarity_boost: 0.8 
          }
        }),
      });

      const apiTime = performance.now();
      console.log(`[ElevenLabs] ${new Date().toISOString()} - API response received after ${((apiTime - startTime) / 1000).toFixed(2)}s`);

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      const conversionTime = performance.now();
      console.log(`[ElevenLabs] ${new Date().toISOString()} - Audio data processed: ${arrayBuffer.byteLength} bytes in ${((conversionTime - apiTime) / 1000).toFixed(3)}s`);
      console.log(`[ElevenLabs] ${new Date().toISOString()} - Total generation time: ${((conversionTime - startTime) / 1000).toFixed(2)}s`);
      
      return arrayBuffer;
      
    } catch (error) {
      console.error('[ElevenLabs] Speech generation failed:', error);
      throw error;
    }
  }

  async playMP3Audio(mp3ArrayBuffer: ArrayBuffer): Promise<void> {
    const playbackStartTime = performance.now();
    console.log(`[ElevenLabs] ${new Date().toISOString()} - Starting MP3 audio playback: ${mp3ArrayBuffer.byteLength} bytes`);
    
    try {
      // Create blob from ArrayBuffer
      const blob = new Blob([mp3ArrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // Create audio element for MP3 playback
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          const playbackEndTime = performance.now();
          console.log(`[ElevenLabs] ${new Date().toISOString()} - Audio playback completed after ${((playbackEndTime - playbackStartTime) / 1000).toFixed(2)}s`);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error(`[ElevenLabs] Audio playback error:`, error);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };
        
        audio.play().catch(error => {
          console.error(`[ElevenLabs] Failed to start audio playback:`, error);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error('[ElevenLabs] MP3 playback setup failed:', error);
      throw error;
    }
  }

  async speakText(text: string, voiceName: string): Promise<void> {
    console.log(`[ElevenLabs] speakText called with voiceName: ${voiceName}`);
    
    try {
      const audioData = await this.generateSpeech(text, { voiceName });
      if (audioData) {
        await this.playMP3Audio(audioData);
      }
    } catch (error) {
      console.error('[ElevenLabs] speakText failed:', error);
      throw error;
    }
  }

  async speakTextWithVoiceId(text: string, voiceId: string): Promise<void> {
    console.log(`[ElevenLabs] speakTextWithVoiceId called with voiceId: ${voiceId}`);
    
    try {
      const audioData = await this.generateSpeech(text, { voiceId });
      if (audioData) {
        await this.playMP3Audio(audioData);
      }
    } catch (error) {
      console.error('[ElevenLabs] speakTextWithVoiceId failed:', error);
      throw error;
    }
  }
}