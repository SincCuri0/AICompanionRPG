/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref, Ref } from 'vue';

export interface AudioState {
  isTTSPlaying: boolean;
  isSTTActive: boolean;
  source: 'conversation' | 'narration' | 'idle';
}

class AudioEventBus {
  private audioState: Ref<AudioState> = ref({
    isTTSPlaying: false,
    isSTTActive: false,
    source: 'idle'
  });

  // Reactive state getter
  get state() {
    return this.audioState;
  }

  // TTS Events
  startTTS(source: 'conversation' | 'narration') {
    console.log(`[AudioEventBus] Starting TTS from ${source}`);
    this.audioState.value = {
      isTTSPlaying: true,
      isSTTActive: false,
      source
    };
  }

  endTTS() {
    console.log(`[AudioEventBus] Ending TTS from ${this.audioState.value.source}`);
    this.audioState.value = {
      isTTSPlaying: false,
      isSTTActive: false,
      source: 'idle'
    };
  }

  // STT Events
  pauseSTT() {
    console.log('[AudioEventBus] Pausing STT');
    this.audioState.value = {
      ...this.audioState.value,
      isSTTActive: false
    };
  }

  resumeSTT() {
    console.log('[AudioEventBus] Resuming STT');
    this.audioState.value = {
      ...this.audioState.value,
      isSTTActive: true
    };
  }

  // Reset to idle state
  reset() {
    console.log('[AudioEventBus] Resetting audio state');
    this.audioState.value = {
      isTTSPlaying: false,
      isSTTActive: false,
      source: 'idle'
    };
  }
}

// Export singleton instance
export const audioEventBus = new AudioEventBus();