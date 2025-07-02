

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref, computed } from 'vue';
import { Genre, VoiceOption } from '../ai-data-types';
import { StartSensitivity } from '@google/genai';
import { DEFAULT_DIALOG_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_INTERRUPT_SENSITIVITY } from '../ai-config';
import { GENRES, VOICE_OPTIONS } from '../ai-data';

export interface ChatMessage {
  id: number;
  sender: 'user' | 'companion';
  text: string;
}

export function useAdventureState() {
  const selectedGenre = ref<Genre | ''>('');

  // AI-Generated Character State
  const generatedCharacterType = ref<string>('');
  const generatedRole = ref<string>('');
  const generatedMood = ref<string>('');
  const generatedStyle = ref<string>('');
  const AIGeneratedVoiceName = ref<string>('');
  const generatedCharacterName = ref<string>('');
  const generatedCharacterDescription = ref<string>('');
  const generatedDetailedVisualDescription = ref<string>('');
  const generatedCoreTrait = ref<string>('');
  const generatedMainWant = ref<string>('');
  const generatedKeyFlaw = ref<string>('');
  const generatedVoicePromptInstruction = ref<string>('');
  const generatedGender = ref<string>('');
  const generatedAge = ref<string>('');
  const generatedAccent = ref<string>('');
  const selectedVoiceId = ref<string>('');

  const currentContextualMood = ref<string>('');
  const currentContextualStyle = ref<string>('');
  const relationshipLevel = ref(50); // Initial relationship level (0-100)

  // Scene-specific state
  const initialSceneNarratorVoice = ref<string>('');
  const initialSceneImagePrompt = ref<string>('');
  const initialSceneImageUrl = ref<string>('');
  const initialSceneNarration = ref<string>('');
  const isNarrating = ref<boolean>(false);
  const rawSceneNarrationLLMPrompt = ref<string>('');

  // Loading and UI state
  const isLoadingAdventure = ref<boolean>(false);
  const isLoadingCharacter = ref<boolean>(false);
  const isLoadingScene = ref<boolean>(false);
  const isConnectingAudio = ref<boolean>(false);
  const playingResponse = ref<boolean>(false);
  const noAudioCount = ref<number>(0);

  const selectedDialogModel = ref<string>(DEFAULT_DIALOG_MODEL);
  const selectedImageModel = ref<string>(DEFAULT_IMAGE_MODEL);
  const selectedInterruptSensitivity = ref<StartSensitivity>(DEFAULT_INTERRUPT_SENSITIVITY);

  const isGameScreenActive = ref(false);

  // Prompts for debugging/display
  const actualCharacterGenerationLLMPrompt = ref<string>('');
  const actualVoicePrompt = ref<string>('');
  const actualCharacterImagePrompt = ref<string>('');

  // Chat history
  const chatHistory = ref<ChatMessage[]>([]);
  const nextMessageId = ref<number>(0);

  const resetFullAdventureState = (isSmallScreenCurrentValue: boolean) => {
    console.log("[State] Resetting full adventure state.");
    selectedGenre.value = ''; 
    generatedCharacterType.value = '';
    generatedRole.value = '';
    generatedMood.value = '';
    generatedStyle.value = '';
    AIGeneratedVoiceName.value = '';
    generatedCharacterName.value = '';
    generatedCharacterDescription.value = '';
    generatedDetailedVisualDescription.value = '';
    generatedCoreTrait.value = '';
    generatedMainWant.value = '';
    generatedKeyFlaw.value = '';
    generatedVoicePromptInstruction.value = '';
    generatedGender.value = '';
    generatedAge.value = '';
    generatedAccent.value = '';
    selectedVoiceId.value = '';
    relationshipLevel.value = 50;

    initialSceneNarratorVoice.value = '';
    initialSceneImagePrompt.value = '';
    initialSceneImageUrl.value = '';
    initialSceneNarration.value = '';
    rawSceneNarrationLLMPrompt.value = '';

    isLoadingAdventure.value = false;
    isLoadingCharacter.value = false;
    isLoadingScene.value = false;
    isConnectingAudio.value = false;
    playingResponse.value = false;
    isNarrating.value = false;
    isGameScreenActive.value = false;

    currentContextualMood.value = '';
    currentContextualStyle.value = '';
    noAudioCount.value = 0;

    actualCharacterGenerationLLMPrompt.value = '';
    actualVoicePrompt.value = '';
    actualCharacterImagePrompt.value = '';

    chatHistory.value = [];
    nextMessageId.value = 0;


    const appBackground = document.getElementById('app-background');
    if (appBackground) appBackground.style.backgroundImage = 'none';

    // Body overflow is handled by useAppUI based on isGameScreenActive and isSmallScreen
  };

  const isGenreSelected = computed(() => !!selectedGenre.value);
  const isCharacterGenerated = computed(() => !!(generatedCharacterName.value && AIGeneratedVoiceName.value && generatedDetailedVisualDescription.value));
  const isSceneDataReady = computed(() => !!(initialSceneImageUrl.value && initialSceneNarration.value && initialSceneNarratorVoice.value));

  const selectionPanelPrompt = computed(() => {
    if (!isGenreSelected.value) return "Select a Genre to begin your adventure!";
    if (isLoadingCharacter.value) return "Generating your character...";
    if (isLoadingScene.value && !isSceneDataReady.value) return "Crafting the opening scene...";
    if (!isCharacterGenerated.value && !isLoadingAdventure.value && !isNarrating.value) return "Press 'Generate Character & Start' to begin your journey!";
    if (isNarrating.value) return "Listen to the narrator...";
    return "Ready for an adventure!";
  });

  const floatingMessageText = computed(() => {
    if (!isGameScreenActive.value) { // Selection screen messages
        // if (forceShowBottomMessage) return selectionPanelPrompt.value; // forceShowBottomMessage is from AppUI, usually for selection screen
        return ''; // No floating message on selection screen unless explicitly needed via forceShowBottomMessage
    }
    // Game screen messages
    if (isLoadingAdventure.value && !isCharacterGenerated.value) return `Creating your ${selectedGenre.value || 'adventure'}...`;
    if (isNarrating.value) return "The story unfolds... (Narration in progress)";
    if (isConnectingAudio.value && generatedCharacterName.value) return `Connecting with ${generatedCharacterName.value}...`;
    if (playingResponse.value && generatedCharacterName.value) return `${generatedCharacterName.value} is speaking... (Talk or click mic to interrupt)`;
    if (isGameScreenActive.value && generatedCharacterName.value && !isNarrating.value && !isConnectingAudio.value && !playingResponse.value) return `Talk to ${generatedCharacterName.value}, or click the mic!`;
    if (isLoadingScene.value && isCharacterGenerated.value) return "Loading the next part of your adventure...";
    return ""; // Default to empty if no specific state matches
  });

  const isInSession = computed(() => isLoadingAdventure.value || isNarrating.value || isConnectingAudio.value || playingResponse.value);

  const characterImageKey = computed(() => {
    return isCharacterGenerated.value ? `${generatedCharacterName.value}-${selectedImageModel.value}-${selectedGenre.value}` : 'default-image';
  });
  
  const selectedMood = computed(() => currentContextualMood.value || generatedMood.value);


  return {
    selectedGenre,
    generatedCharacterType,
    generatedRole,
    generatedMood,
    generatedStyle,
    AIGeneratedVoiceName,
    generatedCharacterName,
    generatedCharacterDescription,
    generatedDetailedVisualDescription,
    generatedCoreTrait,
    generatedMainWant,
    generatedKeyFlaw,
    generatedVoicePromptInstruction,
    generatedGender,
    generatedAge,
    generatedAccent,
    selectedVoiceId,
    currentContextualMood,
    currentContextualStyle,
    relationshipLevel,
    initialSceneNarratorVoice,
    initialSceneImagePrompt,
    initialSceneImageUrl,
    initialSceneNarration,
    isNarrating,
    rawSceneNarrationLLMPrompt,
    isLoadingAdventure,
    isLoadingCharacter,
    isLoadingScene,
    isConnectingAudio,
    playingResponse,
    noAudioCount,
    selectedDialogModel,
    selectedImageModel,
    selectedInterruptSensitivity,
    isGameScreenActive,
    actualCharacterGenerationLLMPrompt,
    actualVoicePrompt,
    actualCharacterImagePrompt,
    chatHistory,
    nextMessageId,
    resetFullAdventureState,
    isGenreSelected,
    isCharacterGenerated,
    isSceneDataReady,
    selectionPanelPrompt,
    floatingMessageText,
    isInSession,
    characterImageKey,
    selectedMood
  };
}