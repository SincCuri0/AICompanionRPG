/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { EndSensitivity, LiveServerMessage, Modality, Session, StartSensitivity, SpeechConfig, Part } from '@google/genai';
import { DialogService, DialogServiceCallbacks, DialogConfig } from '../dialog-service';
import { createBlob, decodeAudioData } from '../audio-utils.ts'; // Changed to .ts
import { QUIET_THRESHOLD, QUIET_DURATION, EXTENDED_QUIET_DURATION, INTERRUPT_SENSITIVITY_OPTIONS } from '../ai-config';

export default defineComponent({
  props: {
    initialMessage: {
      type: String,
      default: "hello, talk like a pirate."
    }
  },
  emits: ['no-audio', 'speaking-start', 'extended-quiet', 'quota-exceeded', 'invalid-voice', 'user-text', 'companion-text'],
  setup(props, { emit }) {
    const isRecording = ref(false);
    const status = ref('');
    const error = ref('');
    const systemWaveformData = ref(new Array(8).fill(0)); 
    const userWaveformData = ref(new Array(8).fill(0)); 
    const selectedInterruptSensitivity = ref<StartSensitivity>(StartSensitivity.START_SENSITIVITY_HIGH);

    let dialogService: DialogService;
    let currentSession: Session | null = null;
    let inputAudioContext: AudioContext;
    let outputAudioContext: AudioContext;
    let inputNode: GainNode;
    let outputNode: GainNode;
    let inputAnalyser: AnalyserNode;
    let outputAnalyser: AnalyserNode;
    let nextStartTime = 0;
    let mediaStream: MediaStream | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let scriptProcessorNode: ScriptProcessorNode | null = null;
    let animationFrameId: number;
    let selectedVoice: string = ''; // This will still be passed from parent, but not used in prebuiltVoiceConfig
    let selectedModel: string = '';
    let audioReceived: boolean = false;
    let quietAudioTimer: number | null = null;
    let hasStartedSpeaking: boolean = false;
    let activeSources: AudioBufferSourceNode[] = [];
    let isInQuietDuration: boolean = false;
    let quietDurationStartTime: number = 0;
    let lastAudioActivityTime: number = Date.now();

    const stopAllAudio = () => {
      activeSources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          // console.warn('Source already stopped or error stopping:', e);
        }
      });
      activeSources = [];
      if (outputAudioContext) {
        nextStartTime = outputAudioContext.currentTime;
      }
    };

    const initAudioContexts = () => {
      try {
        if (!inputAudioContext || inputAudioContext.state === 'closed') {
          inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 16000});
        }
        if (!outputAudioContext || outputAudioContext.state === 'closed') {
          outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
        }

        inputNode = inputAudioContext.createGain();
        outputNode = outputAudioContext.createGain();

        inputAnalyser = inputAudioContext.createAnalyser();
        outputAnalyser = outputAudioContext.createAnalyser();
        inputAnalyser.fftSize = 32;
        inputAnalyser.smoothingTimeConstant = 0.8;
        outputAnalyser.fftSize = 32;
        outputAnalyser.smoothingTimeConstant = 0.8;

        inputNode.connect(inputAnalyser);
        nextStartTime = 0;
      } catch (e) {
        console.error("Error initializing audio contexts:", e);
        updateError(`Failed to initialize audio contexts: ${e instanceof Error ? e.message : String(e)}`);
        throw e; 
      }
    };

    const updateWaveforms = () => {
      if (!inputAnalyser || !outputAnalyser || !isRecording.value) {
        // If not recording, waveforms will hold their last values until explicitly cleared or recording restarts.
        // The animation frame is cancelled in stopRecording.
        return;
      }

      const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);
      const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

      inputAnalyser.getByteFrequencyData(inputData);
      outputAnalyser.getByteFrequencyData(outputData);

      const outputAvg = outputData.reduce((a, b) => a + b, 0) / outputData.length;
      const normalizedOutput = outputAvg / 255;

      if (!hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        if (!quietAudioTimer) {
          quietAudioTimer = window.setTimeout(() => {
            if (audioReceived && isRecording.value) { 
              console.warn('Initial audio too quiet for duration, emitting no-audio event');
              emit('no-audio');
            }
          }, QUIET_DURATION);
        }
      } else if (normalizedOutput >= QUIET_THRESHOLD) {
        if (!hasStartedSpeaking) {
           hasStartedSpeaking = true;
           emit('speaking-start');
        }
        if (quietAudioTimer) {
          clearTimeout(quietAudioTimer);
          quietAudioTimer = null;
        }
        lastAudioActivityTime = Date.now();
      } else if (hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        const currentTime = Date.now();
        if (currentTime - lastAudioActivityTime >= EXTENDED_QUIET_DURATION) {
          emit('extended-quiet');
          lastAudioActivityTime = currentTime; 
        }
      }

      const THRESHOLD = 0.1; 
      const DECAY = 0.7; 

      const updateUserWaveform = (data: Uint8Array, waveformRef: typeof userWaveformData) => {
        const chunkSize = Math.floor(data.length / waveformRef.value.length);
        for (let i = 0; i < waveformRef.value.length; i++) {
          const start = i * chunkSize;
          const end = start + chunkSize;
          const chunk = data.slice(start, end);
          const avg = chunk.length > 0 ? chunk.reduce((a, b) => a + b, 0) / chunk.length : 0;
          const normalizedValue = avg / 255;
          const currentValue = waveformRef.value[i];
          const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
          waveformRef.value[i] = Math.max(newValue, currentValue * DECAY);
        }
      };
      
      updateUserWaveform(inputData, userWaveformData);
      updateUserWaveform(outputData, systemWaveformData);

      animationFrameId = requestAnimationFrame(updateWaveforms);
    };
    
    const initializeDialogService = () => {
      try {
        if (!dialogService) {
          dialogService = new DialogService(process.env.API_KEY!);
        }
      } catch (e) {
        console.error("Error initializing DialogService:", e);
        updateError(`Failed to initialize DialogService: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
      }
    };

    const sessionCallbacks: DialogServiceCallbacks = {
      onopen: () => updateStatus('Opened'),
      onmessage: async (message: LiveServerMessage) => {
        const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData;
        const userTranscribedText = message.serverContent?.outputTranscription?.text;
        const turnComplete = message.serverContent?.turnComplete;
        const interrupted = message.serverContent?.interrupted;

        if (interrupted) {
          console.log('Interruption detected, stopping audio');
          stopAllAudio();
          if (!isRecording.value) isRecording.value = true; 
          return;
        }

        if (userTranscribedText) {
          emit('user-text', userTranscribedText);
        }

        const modelTurnParts: Part[] | undefined = message.serverContent?.modelTurn?.parts;
        if (modelTurnParts) {
          for (const part of modelTurnParts) {
            if (part.text) {
              emit('companion-text', part.text);
              // Assuming one text part per turn for now, or the first one.
              break; 
            }
          }
        }

        if (audio) {
          try {
            if (outputAudioContext.state === 'suspended') {
              await outputAudioContext.resume();
            }
            outputNode.connect(outputAudioContext.destination); 

            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(
                audio.data, 
                outputAudioContext,
                24000, 1
            );
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            activeSources.push(source);
            source.onended = () => {
              const index = activeSources.indexOf(source);
              if (index > -1) activeSources.splice(index, 1);
            };
            source.connect(outputNode);
            outputNode.connect(outputAnalyser); 
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            audioReceived = true;
          } catch (audioProcessingError) {
             console.error("Error processing received audio:", audioProcessingError);
             updateError(`Audio processing error: ${audioProcessingError instanceof Error ? audioProcessingError.message : String(audioProcessingError)}`);
          }
        }
        
        if (turnComplete) {
          if (!audioReceived && isRecording.value) { 
            console.warn('No audio received on turn complete, emitting no-audio event');
            emit('no-audio');
          }
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error("DialogService session error:", e);
        updateError(e.message);
        if (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429')) {
          emit('quota-exceeded');
        } else if (e.message.includes('Requested voice api_name')) {
          // This specific check might become less relevant if prebuiltVoiceConfig is removed,
          // but good to keep for other potential voice-related API errors.
          emit('invalid-voice');
        }
      },
      onclose: (e: CloseEvent) => {
        updateStatus('Session Close: ' + e.reason);
        if (e.code !== 1000 && e.reason) { // 1000 is normal closure
            console.warn(`DialogService session closed abnormally. Code: ${e.code}, Reason: ${e.reason}`);
             if (e.reason && e.reason.includes('Requested voice api_name')) {
                emit('invalid-voice');
            }
        }
      },
    };

    const requestMicrophoneAccess = async () => {
      try {
        updateStatus('Requesting microphone access...');
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        updateStatus('Microphone access granted');
      } catch (err) {
        console.error("Error requesting microphone access:", err);
        updateStatus(`Error requesting microphone: ${err instanceof Error ? err.message : 'Unknown error'}`);
        updateError(`Microphone access denied or unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    const startRecording = async (message: string, voiceNameFromPrompt: string, modelId: string, interruptSens: StartSensitivity) => {
      if (isRecording.value) return;
      
      selectedInterruptSensitivity.value = interruptSens;
      selectedVoice = voiceNameFromPrompt; // Store for reference/logging, but not for prebuiltVoiceConfig
      selectedModel = modelId;
      audioReceived = false;
      hasStartedSpeaking = false;
      isInQuietDuration = true;
      quietDurationStartTime = Date.now();
      lastAudioActivityTime = Date.now();


      try {
        initializeDialogService();
        initAudioContexts(); 

        if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();
        if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();


        if (!mediaStream) await requestMicrophoneAccess();
        if (!mediaStream) throw new Error('Microphone access not granted or previously failed.');

        updateStatus('Starting capture...');

        const sessionConfig: DialogConfig = {
          model: selectedModel,
          responseModalities: [Modality.AUDIO, Modality.TEXT], // Added Modality.TEXT
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: selectedInterruptSensitivity.value,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            },
          },
          speechConfig: {},
        };

        currentSession = await dialogService.connect(sessionConfig, sessionCallbacks);
        
        sourceNode = inputAudioContext.createMediaStreamSource(mediaStream);
        sourceNode.connect(inputNode); 

        const bufferSize = 4096;
        scriptProcessorNode = inputAudioContext.createScriptProcessor(bufferSize, 1, 1);
        scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
          if (!isRecording.value || !currentSession) return;

          if (isInQuietDuration) {
            const currentTime = Date.now();
            if (currentTime - quietDurationStartTime >= QUIET_DURATION) {
              isInQuietDuration = false;
            } else {
              return; 
            }
          }
          const inputBuffer = audioProcessingEvent.inputBuffer;
          const pcmData = inputBuffer.getChannelData(0);
          dialogService.sendRealtimeInput(currentSession, createBlob(pcmData));
        };
        sourceNode.connect(scriptProcessorNode);
        scriptProcessorNode.connect(inputAudioContext.destination); 

        isRecording.value = true;
        updateStatus('🔴 Recording...');
        
        dialogService.sendClientContent(currentSession, { turns: message, turnComplete: true });

        updateWaveforms();

      } catch (err) {
        console.error('Error starting recording:', err);
        updateStatus(`Error starting recording: ${err instanceof Error ? err.message : String(err)}`);
        updateError(`Start recording failed: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error) {
            if (err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('429')) {
                emit('quota-exceeded');
            } else if (err.message.includes('Requested voice api_name')) {
                // This error might still occur if the API internally tries to map something and fails.
                emit('invalid-voice');
            }
        }
        await stopRecording(); 
      }
    };

    const stopRecording = async () => {
      if (!isRecording.value && !mediaStream && (!inputAudioContext || inputAudioContext.state === 'closed')) return;

      updateStatus('Stopping recording...');
      isRecording.value = false;
      hasStartedSpeaking = false;
      isInQuietDuration = false;

      stopAllAudio();

      if (quietAudioTimer) {
        clearTimeout(quietAudioTimer);
        quietAudioTimer = null;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0; // Explicitly clear
      }
      
      // Explicitly clear waveform data to reset UI
      userWaveformData.value = new Array(userWaveformData.value.length).fill(0);
      systemWaveformData.value = new Array(systemWaveformData.value.length).fill(0);

      if (scriptProcessorNode) {
        scriptProcessorNode.disconnect();
        scriptProcessorNode.onaudioprocess = null; // Remove handler
        scriptProcessorNode = null;
      }
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null; 
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      
      if (currentSession) {
        try {
            await dialogService.closeSession(currentSession);
        } catch (e) {
            console.error("Error closing session during stopRecording:", e);
        }
        currentSession = null;
      }
      updateStatus('Recording stopped. Click Start to begin again.');
    };
    
    const updateStatus = (msg: string) => { status.value = msg; };
    const updateError = (msg: string) => { error.value = msg; console.error("LiveAudioComponent Error:", msg);};

    const sendInstructionToAI = (instruction: string) => {
      if (currentSession && dialogService && isRecording.value) {
        console.log("Sending contextual instruction to AI:", instruction);
        dialogService.sendClientContent(currentSession, { turns: instruction, turnComplete: true });
      } else {
        console.warn("Cannot send instruction: No active session, dialogService, or not recording.");
      }
    };

    onMounted(async () => {
      try {
        initializeDialogService();
      } catch (e) {
        console.error("Failed to initialize DialogService on mount:", e);
      }
      try {
        initAudioContexts();
      } catch (e) {
         console.error("Failed to initialize AudioContexts on mount:", e);
      }
      await requestMicrophoneAccess(); // Errors handled within
       window.addEventListener("beforeunload", async () => {
          if (currentSession && dialogService) {
            try {
              await dialogService.closeSession(currentSession);
            } catch (e) {
              console.error("Error closing session on beforeunload:", e);
            }
          }
        });
    });

    onUnmounted(async () => {
      await stopRecording(); // Handles its own errors
      if (currentSession && dialogService) { // Check again in case stopRecording didn't nullify it due to an error
        try {
          await dialogService.closeSession(currentSession);
        } catch (e) {
          console.error("Error closing session on unmount:", e);
        }
      }
      if (animationFrameId) { // Should be cleared by stopRecording, but defensive
        cancelAnimationFrame(animationFrameId);
      }
       if (inputAudioContext && inputAudioContext.state !== 'closed') {
        try {
          await inputAudioContext.close();
        } catch (e) {
          console.error("Error closing inputAudioContext on unmount:", e);
        }
      }
      if (outputAudioContext && outputAudioContext.state !== 'closed') {
       try {
        await outputAudioContext.close();
       } catch (e) {
         console.error("Error closing outputAudioContext on unmount:", e);
       }
      }
    });

    return {
      isRecording,
      status,
      error,
      systemWaveformData,
      userWaveformData,
      selectedInterruptSensitivity, 
      interruptSensitivityOptions: INTERRUPT_SENSITIVITY_OPTIONS, 
      startRecording,
      stopRecording,
      sendInstructionToAI
    };
  },
  template: `
    <div class="hidden">
      <div v-if="status">{{ status }}</div>
      <div v-if="error" class="text-red-400">{{ error }}</div>
    </div>
  `
});