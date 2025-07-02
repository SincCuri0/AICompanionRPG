/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface STTConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export class STTService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private isVoiceActivationMode = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private voiceDetectionThreshold = 30; // Lower threshold for better sensitivity
  private lastVoiceDetectionTime = 0;
  private voiceDetectionCooldown = 1000; // 1 second cooldown between triggers

  constructor() {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  async startListening(config: STTConfig = {}): Promise<string> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    if (this.isListening) {
      throw new Error('Already listening');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }

      // Configure recognition
      this.recognition.lang = config.language || 'en-US';
      this.recognition.continuous = config.continuous || false;
      this.recognition.interimResults = config.interimResults || true; // Enable interim results for better feedback
      this.recognition.maxAlternatives = 1;
      
      // Add these properties for better speech detection
      if (this.recognition.hasOwnProperty('startThreshold')) {
        (this.recognition as any).startThreshold = 0.5;
      }
      if (this.recognition.hasOwnProperty('endThreshold')) {
        (this.recognition as any).endThreshold = 0.3;
      }

      let finalTranscript = '';
      let hasSpokenSomething = false;
      let silenceTimer: number | null = null;

      // Clear any existing silence timer
      const clearSilenceTimer = () => {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      };

      // Set a silence timer to auto-stop after no speech
      const setSilenceTimer = () => {
        clearSilenceTimer();
        silenceTimer = setTimeout(() => {
          if (this.isListening && hasSpokenSomething) {
            console.log('Auto-stopping due to silence after speech');
            this.stopListening();
          }
        }, 1500); // 1.5 seconds of silence after speech
      };

      this.recognition.onstart = () => {
        this.isListening = true;
        console.log('Speech recognition started');
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            hasSpokenSomething = true;
            console.log(`[STT] Final transcript: "${transcript}"`);
            setSilenceTimer(); // Start silence timer after final speech
          } else {
            interimTranscript += transcript;
            if (transcript.trim().length > 0) {
              hasSpokenSomething = true;
              console.log(`[STT] Interim transcript: "${transcript}"`);
              clearSilenceTimer(); // Clear timer while speaking
            }
          }
        }

        // If we have a final result and not in continuous mode, resolve immediately
        if (finalTranscript && !config.continuous) {
          clearSilenceTimer();
          this.stopListening();
          console.log(`[STT] Resolving with final transcript: "${finalTranscript.trim()}"`);
          resolve(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        clearSilenceTimer();
        console.error('Speech recognition error:', event.error);
        
        // Handle specific errors more gracefully
        if (event.error === 'no-speech') {
          reject(new Error('No speech detected. Please try speaking again.'));
        } else if (event.error === 'audio-capture') {
          reject(new Error('Microphone access denied. Please check permissions.'));
        } else if (event.error === 'not-allowed') {
          reject(new Error('Microphone access not allowed. Please enable microphone permissions.'));
        } else {
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        clearSilenceTimer();
        console.log('Speech recognition ended');
        console.log(`[STT] Final result - transcript: "${finalTranscript}", hasSpoken: ${hasSpokenSomething}`);
        
        if (finalTranscript && finalTranscript.trim()) {
          resolve(finalTranscript.trim());
        } else if (hasSpokenSomething) {
          reject(new Error('Speech was detected but not clearly understood. Please speak more clearly and try again.'));
        } else {
          reject(new Error('No speech detected. Please try speaking louder.'));
        }
      };

      // Start recognition
      try {
        this.recognition.start();
        
        // Set a maximum listening time (45 seconds, increased)
        setTimeout(() => {
          if (this.isListening) {
            console.log('Maximum listening time reached');
            this.stopListening();
          }
        }, 45000);
        
      } catch (error) {
        this.isListening = false;
        clearSilenceTimer();
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  pauseListening(): void {
    if (this.recognition && this.isListening) {
      console.log('[STT] Pausing speech recognition');
      this.recognition.stop();
    }
  }

  resumeListening(): void {
    if (this.recognition && !this.isListening) {
      console.log('[STT] Resuming speech recognition');
      this.recognition.start();
      this.isListening = true;
    }
  }

  private async setupVoiceDetection(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      console.log('[STT] Voice detection setup completed');
    } catch (error) {
      console.error('[STT] Failed to setup voice detection:', error);
      throw error;
    }
  }

  private getAudioLevel(): number {
    if (!this.analyser) return 0;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength;
  }

  private cleanupVoiceDetection(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  async startVoiceActivationMode(): Promise<string> {
    if (this.isVoiceActivationMode) {
      throw new Error('Voice activation mode already active');
    }

    console.log('[STT] Starting voice activation mode...');
    this.isVoiceActivationMode = true;

    try {
      await this.setupVoiceDetection();
      
      return new Promise((resolve, reject) => {
        // Set a maximum time for voice activation (60 seconds)
        const timeout = setTimeout(() => {
          if (this.isVoiceActivationMode) {
            this.stopVoiceActivationMode();
            reject(new Error('Voice activation timeout - no speech detected within 60 seconds'));
          }
        }, 60000);

        const checkForVoice = () => {
          if (!this.isVoiceActivationMode) {
            clearTimeout(timeout);
            this.cleanupVoiceDetection();
            reject(new Error('Voice activation mode stopped'));
            return;
          }

          const audioLevel = this.getAudioLevel();
          const now = Date.now();
          
          if (audioLevel > this.voiceDetectionThreshold && 
              (now - this.lastVoiceDetectionTime) > this.voiceDetectionCooldown) {
            console.log(`[STT] Voice detected! Audio level: ${audioLevel.toFixed(1)}`);
            console.log('[STT] Starting speech recognition...');
            this.lastVoiceDetectionTime = now;
            
            // Voice detected, start actual recording with better settings
            this.startListening({
              language: 'en-US',
              continuous: false, // Change back to false for single utterance
              interimResults: true // Get interim results for better detection
            }).then(transcript => {
              clearTimeout(timeout);
              this.stopVoiceActivationMode();
              if (transcript && transcript.trim()) {
                console.log(`[STT] Voice activation successful, captured: "${transcript}"`);
                resolve(transcript);
              } else {
                reject(new Error('No speech captured despite voice detection'));
              }
            }).catch(error => {
              // Don't clear timeout here, let it continue monitoring
              // If no-speech error or unclear speech, continue monitoring instead of failing
              if (error.message.includes('no-speech') || 
                  error.message.includes('not clearly understood') ||
                  error.message.includes('speak more clearly')) {
                console.log('[STT] Speech issue detected, continuing to monitor for clearer speech...');
                setTimeout(checkForVoice, 500); // Wait a bit longer before retry
              } else {
                clearTimeout(timeout);
                this.stopVoiceActivationMode();
                reject(error);
              }
            });
          } else {
            // Continue monitoring
            setTimeout(checkForVoice, 100); // Check every 100ms
          }
        };

        checkForVoice();
      });
    } catch (error) {
      this.isVoiceActivationMode = false;
      this.cleanupVoiceDetection();
      throw error;
    }
  }

  stopVoiceActivationMode(): void {
    if (this.isVoiceActivationMode) {
      console.log('[STT] Stopping voice activation mode');
      this.isVoiceActivationMode = false;
      this.cleanupVoiceDetection();
    }
  }

  getIsVoiceActivationMode(): boolean {
    return this.isVoiceActivationMode;
  }
}