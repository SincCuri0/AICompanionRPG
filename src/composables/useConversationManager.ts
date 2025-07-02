/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref, Ref, watch } from 'vue';
import { ConversationService, ConversationConfig } from '../conversation-service';
import { audioEventBus } from '../audio-event-bus';
import type { useAdventureState } from './useAdventureState';

type AdventureState = ReturnType<typeof useAdventureState>;

export function useConversationManager(
    state: AdventureState,
    apiKey: string,
    liveAudioRef: Ref<any>
) {
    const {
        isCharacterGenerated, isNarrating, isLoadingAdventure, selectedGenre,
        generatedCharacterName, generatedCharacterDescription, generatedCoreTrait,
        generatedMainWant, generatedKeyFlaw, generatedMood, generatedStyle,
        generatedVoicePromptInstruction, AIGeneratedVoiceName, selectedVoiceId,
        currentContextualMood, currentContextualStyle,
        chatHistory
    } = state;

    const conversationService = new ConversationService(apiKey);
    const isListening = ref(false);
    const isProcessing = ref(false);
    const isSpeaking = ref(false);
    const isConnectingAudio = ref(false);
    const conversationMessage = ref('');

    // Watch audio state changes and control STT accordingly
    watch(() => audioEventBus.state.value, (newState, oldState) => {
        if (!newState.isSTTActive && newState.isTTSPlaying) {
            // Pause STT during TTS
            if (isListening.value) {
                conversationService.pauseListening();
            }
        } else if (newState.isSTTActive && !newState.isTTSPlaying && oldState?.isTTSPlaying) {
            // Resume STT after TTS ends (only if TTS was previously playing)
            setTimeout(async () => {
                if (isCharacterGenerated.value && !isNarrating.value && !isLoadingAdventure.value) {
                    await startListening();
                }
            }, 1000);
        }
    }, { deep: true });

    const buildConversationConfig = (): ConversationConfig => {
        console.log('[ConversationManager] Building config with selectedVoiceId:', selectedVoiceId.value);
        return {
            characterName: generatedCharacterName.value,
            characterDescription: generatedCharacterDescription.value,
            voiceName: AIGeneratedVoiceName.value,
            voiceId: selectedVoiceId.value,
            genre: selectedGenre.value?.name || 'adventure',
            coreTrait: generatedCoreTrait.value,
            mainWant: generatedMainWant.value,
            keyFlaw: generatedKeyFlaw.value,
            voicePromptInstruction: generatedVoicePromptInstruction.value,
            currentMood: currentContextualMood.value || generatedMood.value,
            currentStyle: currentContextualStyle.value || generatedStyle.value
        };
    };

    const startListening = async (): Promise<void> => {
        if (!conversationService.isSTTSupported()) {
            throw new Error('Speech recognition is not supported in this browser');
        }

        if (isListening.value || isProcessing.value || isSpeaking.value || isNarrating.value) {
            console.warn('Cannot start listening: audio playback in progress or already listening');
            return;
        }

        try {
            isListening.value = true;
            conversationMessage.value = 'Listening... Speak now!';

            // Use simple press-to-record approach
            const userInput = await conversationService.startListening();
            
            if (userInput && userInput.trim()) {
                conversationMessage.value = 'Processing your speech...';
                await processUserInput(userInput);
            } else {
                console.warn('No speech detected or empty input received');
                conversationMessage.value = 'No speech detected. Please speak clearly and try again.';
                setTimeout(() => {
                    conversationMessage.value = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Listening failed:', error);
            conversationMessage.value = 'Could not hear you. Please try again.';
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        } finally {
            isListening.value = false;
        }
    };

    const stopListening = (): void => {
        if (isListening.value) {
            conversationService.stopListening();
            isListening.value = false;
            conversationMessage.value = '';
        }
    };

    const processUserInput = async (userInput: string): Promise<void> => {
        if (isProcessing.value || isSpeaking.value) {
            return;
        }

        try {
            isProcessing.value = true;
            conversationMessage.value = 'Processing...';

            const config = buildConversationConfig();
            
            // Add user message to chat history
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'user',
                text: userInput
            });

            conversationMessage.value = `${config.characterName} is thinking...`;

            // Generate response without auto-speaking
            const aiMessage = await conversationService.processUserInput(userInput, config, false);

            // Add AI response to chat history immediately
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'companion',
                text: aiMessage.text
            });

            // Update UI state for speaking and wait for TTS to complete
            isSpeaking.value = true;
            conversationMessage.value = `${config.characterName} is speaking...`;

            // Signal that TTS is starting
            audioEventBus.startTTS('conversation');
            
            // Mute microphone during TTS playback to prevent feedback
            if (liveAudioRef.value?.muteMicrophone) {
                liveAudioRef.value.muteMicrophone();
            }

            try {
                await conversationService.speakText(aiMessage.text, config.voiceName, config.voiceId);
            } catch (speechError) {
                console.error('TTS playback failed:', speechError);
            } finally {
                // Clear speaking state first
                isSpeaking.value = false;
                
                // Unmute microphone after TTS playback
                if (liveAudioRef.value?.unmuteMicrophone) {
                    liveAudioRef.value.unmuteMicrophone();
                }
                
                // Signal that TTS has ended
                audioEventBus.endTTS();
            }

        } catch (error) {
            console.error('Failed to process user input:', error);
            conversationMessage.value = 'Sorry, I had trouble understanding. Please try again.';
            
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        } finally {
            isProcessing.value = false;
            conversationMessage.value = '';
            
            // Longer delay to avoid immediately picking up any audio tail-end
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    };

    const handleTextInput = async (text: string): Promise<void> => {
        if (text.trim()) {
            await processUserInput(text.trim());
        }
    };

    const onStartOrResumeAdventure = async (): Promise<void> => {
        if (!isCharacterGenerated.value || isNarrating.value || isLoadingAdventure.value) {
            console.warn('Cannot start conversation: adventure not ready');
            return;
        }

        // Check if audio system is currently playing TTS
        if (audioEventBus.state.value.isTTSPlaying) {
            console.log('[ConversationManager] TTS is playing, will start listening when it ends');
            return; // The watcher will start listening when TTS ends
        }

        await startListening();
    };

    const handlePlayerStopClick = (): void => {
        if (isListening.value) {
            stopListening();
        } else if (isSpeaking.value) {
            // Could implement speech interruption here if needed
            conversationMessage.value = '';
        }
    };

    const handleNoAudio = (): void => {
        conversationMessage.value = 'No microphone detected. Please check your audio settings.';
        setTimeout(() => {
            conversationMessage.value = '';
        }, 5000);
    };

    const handleSpeakingStart = (): void => {
        // Not needed for STT approach
    };

    const handleExtendedQuiet = (): void => {
        if (isListening.value) {
            stopListening();
            conversationMessage.value = 'No speech detected. Please try again.';
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        }
    };

    const handleDialogQuotaExceeded = (): void => {
        console.error('Dialog quota exceeded');
        conversationMessage.value = 'Service temporarily unavailable. Please try again later.';
        setTimeout(() => {
            conversationMessage.value = '';
        }, 5000);
    };

    const handleInvalidVoiceError = (): void => {
        console.error('Invalid voice configuration');
        conversationMessage.value = 'Voice configuration error. Please restart the adventure.';
    };

    const handleTriggerContextualChange = (): void => {
        // Could implement mood/style changes here
        console.log('Contextual change triggered');
    };

    return {
        // State
        isListening,
        isProcessing,
        isSpeaking,
        isConnectingAudio,
        conversationMessage,
        
        // Methods
        onStartOrResumeAdventure,
        handlePlayerStopClick,
        handleNoAudio,
        handleSpeakingStart,
        handleExtendedQuiet,
        handleDialogQuotaExceeded,
        handleInvalidVoiceError,
        handleTriggerContextualChange,
        handleTextInput,
        
        // Service methods
        startListening,
        stopListening,
        processUserInput
    };
}