/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ElevenLabsTTSService } from './elevenlabs-tts-service';
import { voiceSelectionService } from './voice-selection-service';

export class NarrationService {
  private ttsService: ElevenLabsTTSService;

  constructor(geminiApiKey: string) {
    // Use ElevenLabs API key from environment (defined in vite.config.ts)
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required for narration. Add it to .env.local");
    }
    this.ttsService = new ElevenLabsTTSService(elevenLabsApiKey);
  }

  async playNarration(text: string, voiceName: string, genre?: string): Promise<void> {
    const startTime = performance.now();
    console.log("[NarrationService] Starting TTS narration. Text:", text.substring(0,50)+'...', "Voice:", voiceName);
    
    if (!text) {
      console.warn("[NarrationService] No narration text provided. Skipping narration.");
      return;
    }

    try {
      // Use voice selection service to pick appropriate narrator voice if genre provided
      if (genre) {
        const selectedNarratorVoiceId = voiceSelectionService.selectNarratorVoice(genre, 'opening');
        console.log("[NarrationService] Using selected narrator voice ID:", selectedNarratorVoiceId);
        await this.ttsService.speakTextWithVoiceId(text, selectedNarratorVoiceId);
      } else {
        // Fallback to original voice name system
        console.log("[NarrationService] Using fallback voice name:", voiceName);
        await this.ttsService.speakText(text, voiceName);
      }
      const duration = performance.now() - startTime;
      console.log(`[NarrationService] ⏱️ TTS narration completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error("[NarrationService] TTS narration failed:", error);
      // Don't throw - just log and continue
    }
  }
}