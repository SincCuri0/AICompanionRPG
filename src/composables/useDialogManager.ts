
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref, Ref, nextTick } from 'vue';
import { Genre } from '../ai-data-types';
import { buildVoicePrompt } from '../prompt-builder';
import LiveAudioComponent from '../components/LiveAudioComponent.tsx'; // For type
import type { useAdventureState } from './useAdventureState'; // For type inference

type AdventureState = ReturnType<typeof useAdventureState>;

export function useDialogManager(
    state: AdventureState,
    liveAudioRef: Ref<InstanceType<typeof LiveAudioComponent> | null>
) {
    const {
        isCharacterGenerated, isNarrating, isLoadingAdventure, selectedGenre,
        isConnectingAudio, playingResponse, noAudioCount,
        generatedCharacterName, generatedCharacterDescription, generatedCoreTrait,
        generatedMainWant, generatedKeyFlaw, generatedMood, generatedStyle,
        generatedVoicePromptInstruction, AIGeneratedVoiceName,
        selectedDialogModel, selectedInterruptSensitivity,
        actualVoicePrompt, currentContextualMood, currentContextualStyle,
        resetFullAdventureState: _resetFullAdventureState
    } = state;

    // Need isSmallScreen for resetFullAdventureState if it's called from here
    const isSmallScreen = ref(window.innerWidth < 1024); 
    const resetFullAdventureState = () => _resetFullAdventureState(isSmallScreen.value);


    const onStartOrResumeAdventure = async () => {
        console.log("[DialogManager] Attempting to start/resume adventure.");
        if (!isCharacterGenerated.value || isNarrating.value || isLoadingAdventure.value || !selectedGenre.value) {
            console.warn("[DialogManager] Cannot start/resume adventure. Conditions not met:",
                { isCharGen: isCharacterGenerated.value, isNarrating: isNarrating.value, isLoading: isLoadingAdventure.value, genre: selectedGenre.value });
            return;
        }
        isConnectingAudio.value = true;
        playingResponse.value = false;
        console.log("[DialogManager] isConnectingAudio set to true.");

        const currentTime = new Date().toLocaleTimeString();
        actualVoicePrompt.value = buildVoicePrompt(
            generatedCharacterName.value,
            generatedCharacterDescription.value,
            generatedCoreTrait.value,
            generatedMainWant.value,
            generatedKeyFlaw.value,
            selectedGenre.value as Genre,
            generatedRole.value, // Added from state
            currentContextualMood.value || generatedMood.value,
            currentContextualStyle.value || generatedStyle.value,
            generatedVoicePromptInstruction.value,
            AIGeneratedVoiceName.value,
            currentTime
        );
        console.log("[DialogManager] Voice prompt for companion built:", actualVoicePrompt.value.substring(0,100) + "...");

        await nextTick();

        if (liveAudioRef.value) {
            console.log("[DialogManager] Calling LiveAudioComponent.startRecording...");
            liveAudioRef.value.startRecording(
                actualVoicePrompt.value,
                AIGeneratedVoiceName.value,
                selectedDialogModel.value,
                selectedInterruptSensitivity.value
            ).then(() => {
                console.log("[DialogManager] LiveAudioComponent.startRecording resolved.");
                isConnectingAudio.value = false;
                console.log("[DialogManager] isConnectingAudio set to false.");
            }).catch(err => {
                console.error("[DialogManager] Failed to start LiveAudioComponent recording:", err);
                isConnectingAudio.value = false;
                playingResponse.value = false;
                alert(`Error starting audio session: ${err instanceof Error ? err.message : String(err)}. Please check console.`);
            });
        } else {
            console.error("[DialogManager] LiveAudioComponent ref not available.");
            isConnectingAudio.value = false;
        }
    };

    const handlePlayerStopClick = () => {
        console.log("[DialogManager] Player stop clicked.");
        playingResponse.value = false;
        if (liveAudioRef.value) {
            liveAudioRef.value.stopRecording();
        }
    };

    const handleNoAudio = () => {
        console.warn('[DialogManager] LiveAudioComponent reported no audio.');
        noAudioCount.value++;
        if (liveAudioRef.value) {
            liveAudioRef.value.stopRecording();
        }
        playingResponse.value = false;
        isConnectingAudio.value = false;
        if (noAudioCount.value >= 2) {
            alert("No audio seems to be coming from the companion. Please check your connection or try restarting the adventure.");
        } else {
            alert("The companion didn't respond with audio. You can try speaking again.");
        }
    };

    const handleSpeakingStart = () => {
        console.log("[DialogManager] Companion speaking started.");
        playingResponse.value = true;
        isConnectingAudio.value = false;
        noAudioCount.value = 0;
    };

    const handleExtendedQuiet = () => {
        console.log("[DialogManager] Extended quiet detected. Stopping current turn.");
        if (liveAudioRef.value) {
            liveAudioRef.value.stopRecording();
        }
        playingResponse.value = false;
    };
    
    // Dialog specific quota exceeded
    const handleDialogQuotaExceeded = () => {
        console.warn(`[DialogManager] API quota exceeded from dialog.`);
        alert("Dialog API quota exceeded. The adventure cannot continue. Check Google Cloud project quotas.");
        resetFullAdventureState(); // This needs isSmallScreen context
        if (liveAudioRef.value) {
            liveAudioRef.value.stopRecording();
        }
    };


    const handleInvalidVoiceError = () => {
        console.error("[DialogManager] Invalid voice API name used for DialogService.");
        alert("There was an issue with the selected voice for the companion. Please try regenerating the character or restarting the adventure.");
        isConnectingAudio.value = false;
        playingResponse.value = false;
        isLoadingAdventure.value = false;
        if (liveAudioRef.value) {
            liveAudioRef.value.stopRecording();
        }
    };
    
    const handleTriggerContextualChange = (mood: string, style: string) => {
        console.log(`[DialogManager] Triggering contextual change: Mood=${mood}, Style=${style}`);
        currentContextualMood.value = mood;
        currentContextualStyle.value = style;
        
        const contextualUpdateInstruction = 
            `SYSTEM_COMMAND: Your mood is now '${mood}' and your speaking style is now '${style}'. Adhere to this new context for subsequent responses, incorporating it into your persona as ${generatedCharacterName.value}.`;

        if (liveAudioRef.value) {
            liveAudioRef.value.sendInstructionToAI(contextualUpdateInstruction);
        } else {
            console.warn("[DialogManager] Cannot send contextual change: LiveAudioComponent not available.");
        }
    };
    
    // Moved from AdventureSetup as it's more about dialog/companion interaction
    const { generatedRole } = state; // Add this line to access generatedRole

    return {
        onStartOrResumeAdventure,
        handlePlayerStopClick,
        handleNoAudio,
        handleSpeakingStart,
        handleExtendedQuiet,
        handleDialogQuotaExceeded, // Specific name
        handleInvalidVoiceError,
        handleTriggerContextualChange
    };
}
