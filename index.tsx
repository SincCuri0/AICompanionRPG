/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createApp, defineComponent, onMounted, onUnmounted, ref, nextTick, computed } from 'vue'; // Keep nextTick here
import { GoogleGenAI } from '@google/genai';
import { ImageGeneratorService } from './src/image-generator-service';

import {
  AVAILABLE_DIALOG_MODELS,
  AVAILABLE_IMAGE_MODELS,
  INTERRUPT_SENSITIVITY_OPTIONS
} from './src/ai-config';
import { GENRES } from './src/ai-data';

// Composables
import { useAdventureState } from './src/composables/useAdventureState';
import { useAdventureSetup } from './src/composables/useAdventureSetup'; 
import { useConversationManager } from './src/composables/useConversationManager';
import { useAppUI } from './src/composables/useAppUI';

// Components
import LiveAudioComponent from './src/components/LiveAudioComponent';
import SelectionPanel from './src/components/SelectionPanel';
import SceneDisplayPanel from './src/components/SceneDisplayPanel';
import CompanionInfoPanel from './src/components/CompanionInfoPanel';
import ShareModal from './src/components/ShareModal';
import RawPromptsModal from './src/components/RawPromptsModal';

const SCREEN_PADDING = 30; // Base padding unit

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: {
      getHostUrl(): Promise<string>;
    };
  }
}

const ImagineOrchestrator = defineComponent({
  components: {
    LiveAudioComponent,
    SelectionPanel,
    SceneDisplayPanel,
    CompanionInfoPanel,
    ShareModal,
    RawPromptsModal,
  },
  setup() {
    const apiKey = process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const imageGeneratorService = new ImageGeneratorService(apiKey!);

    const liveAudioRef = ref<InstanceType<typeof LiveAudioComponent> | null>(null);
    const companionInfoPanelRef = ref<InstanceType<typeof CompanionInfoPanel> | null>(null);

    // Initialize composables
    const adventureState = useAdventureState();
    const appUI = useAppUI(adventureState);
    const conversationManager = useConversationManager(adventureState, apiKey, liveAudioRef);
    const adventureSetup = useAdventureSetup(ai, imageGeneratorService, adventureState, apiKey);


    const handleUpdateImagePrompt = (prompt: string) => {
      adventureState.actualCharacterImagePrompt.value = prompt;
    };
    
    // This handler remains but the button is removed from main UI
    

    const handleUserText = async (text: string) => {
      if (text.trim()) {
        await conversationManager.handleTextInput(text.trim());
      }
    };

    const handleCompanionText = (text: string) => {
      console.log('Companion text:', text);
    };

    onUnmounted(() => {
      adventureState.resetFullAdventureState(appUI.isSmallScreen.value);
    });

    const isMicDisabled = computed(() => {
      return adventureState.isLoadingAdventure.value || adventureState.isNarrating.value || conversationManager.isProcessing.value;
    });
    
    const waveformState = computed(() => {
      if (adventureState.isLoadingAdventure.value && !adventureState.isCharacterGenerated.value) return 'loading'; 
      if (adventureState.isNarrating.value) return 'narrating'; 
      if (conversationManager.isProcessing.value) return 'connecting';
      if (conversationManager.isSpeaking.value) return 'systemSpeaking';
      if (conversationManager.isListening.value) return 'userSpeaking';
      
      return 'idle';
    });
    
    const micButtonClickHandler = () => {
        if (adventureState.isNarrating.value) return; 

        if (isMicDisabled.value && waveformState.value !== 'systemSpeaking') {
            return;
        }
        if (waveformState.value === 'systemSpeaking' || waveformState.value === 'userSpeaking') {
            conversationManager.handlePlayerStopClick();
        } else {
            conversationManager.onStartOrResumeAdventure();
        }
    };

    const showCompanionInfo = ref(false);
    const toggleCompanionInfo = () => {
      showCompanionInfo.value = !showCompanionInfo.value;
    };


    return {
      // State and computed from adventureState
      ...adventureState,
      
      // UI state and methods from appUI
      ...appUI,

      // Adventure setup methods
      handleStartAdventureSetup: () => {
        adventureState.isGameScreenActive.value = true;
        document.body.style.overflow = 'hidden';
        adventureSetup.handleStartAdventureSetup();
      },
      handleRegenerateSceneImage: adventureSetup.handleRegenerateSceneImage,
      handleGenreSelected: adventureSetup.handleGenreSelected,

      // Conversation interaction methods from conversationManager
      onStartOrResumeAdventure: conversationManager.onStartOrResumeAdventure,
      handlePlayerStopClick: conversationManager.handlePlayerStopClick,
      handleNoAudio: conversationManager.handleNoAudio,
      handleSpeakingStart: conversationManager.handleSpeakingStart,
      handleExtendedQuiet: conversationManager.handleExtendedQuiet,
      handleQuotaExceeded: (source: 'characterImage' | 'sceneImage' | 'dialog') => {
        if (source === 'dialog') conversationManager.handleDialogQuotaExceeded();
        else adventureSetup.handleQuotaExceeded(source); 
      },
      handleInvalidVoiceError: conversationManager.handleInvalidVoiceError,
      handleTriggerContextualChange: conversationManager.handleTriggerContextualChange,
      
      // Chat handlers
      handleUserText,
      handleCompanionText,

      // Component refs
      liveAudioRef,
      companionInfoPanelRef, 
      
      // Other direct values/methods for the template
      GENRES_LIST: GENRES, 
      SCREEN_PADDING,
      
      handleUpdateImagePrompt,

      isMicDisabled,
      waveformState,
      micButtonClickHandler,
      showCompanionInfo,
      toggleCompanionInfo,
    };
  },
  template: `
    <div id="imagine-orchestrator" class="w-full h-screen flex flex-col transition-all duration-500 ease-in-out"
         :class="{'items-center justify-center': !isGameScreenActive, 'items-stretch justify-start': isGameScreenActive}">

      <!-- Selection Screen -->
      <Transition name="fade">
        <div v-if="!isGameScreenActive" class="w-full max-w-4xl p-4 flex flex-col items-center">
          <SelectionPanel 
            :genres="GENRES_LIST"
            :selected-genre="selectedGenre"
            :is-connecting="isLoadingCharacter || (isLoadingScene && !isCharacterGenerated)"
            :is-genre-selected="isGenreSelected"
            :selection-prompt="selectionPanelPrompt"
            @genre-selected="handleGenreSelected"
            @generate-character="handleStartAdventureSetup"
          />
        </div>
      </Transition>

      <!-- Game Screen -->
      <Transition name="fade">
        <div v-if="isGameScreenActive" class="w-full h-screen flex flex-col">

          <!-- Genre Header -->
          <div class="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 px-4 py-3">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-3">
                  <div class="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  <span class="text-white text-lg font-semibold">{{ selectedGenre }}</span>
                </div>
                <!-- Adventure Status -->
                <div class="hidden sm:flex items-center space-x-2 text-xs">
                  <div class="w-1 h-1 bg-gray-500 rounded-full"></div>
                  <span class="text-gray-400">
                    <span v-if="isLoadingAdventure && !isCharacterGenerated">Creating adventure...</span>
                    <span v-else-if="isCharacterGenerated && !isSceneDataReady">Adventure ready</span>
                    <span v-else-if="isSceneDataReady">In progress</span>
                    <span v-else>Waiting to begin</span>
                  </span>
                </div>
              </div>
              <!-- Companion toggle button for screens without companion panel -->
              <button v-if="!shouldShowCompanionPanel"
                      @click="toggleCompanionInfo"
                      class="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="text-gray-300 text-sm">Companion</span>
              </button>
            </div>
          </div>

          <!-- Main Content Area - Fully Justified -->
          <div class="flex-1 flex items-center justify-center p-4 lg:p-6 relative"
               :style="{paddingBottom: (isSmallScreen ? 180 : 100) + 'px'}">

            <!-- Game Window - Centered and Fully Justified -->
            <div class="w-full h-full flex items-center justify-center"
                 :class="{
                   'max-w-7xl': isSmallScreen,
                   'max-w-5xl': !isSmallScreen && !shouldShowCompanionPanel,
                   'max-w-4xl': shouldShowCompanionPanel
                 }">
              <SceneDisplayPanel
                class="w-full h-full max-h-[calc(100vh-180px)] lg:max-h-[calc(100vh-200px)]"
                :is-loading="isLoadingScene || (isLoadingAdventure && !isCharacterGenerated && !isSceneDataReady)"
                :chat-history="chatHistory"
                :companion-name="generatedCharacterName"
                :is-exploration-mode="true"
              />
            </div>

            <!-- Companion Panel - ABSOLUTE positioned next to centered panel -->
            <div v-if="shouldShowCompanionPanel" class="absolute top-0 right-0 w-80 h-full">
              <CompanionInfoPanel
                ref="companionInfoPanelRef"
                :character-name="generatedCharacterName"
                :character-description="generatedCharacterDescription"
                :detailed-visual-description="generatedDetailedVisualDescription"
                :genre="selectedGenre"
                :image-model="selectedImageModel"
                :relationship-level="relationshipLevel"
                :image-key="characterImageKey"
                :is-loading-character="isLoadingCharacter || (isLoadingAdventure && !isCharacterGenerated)"
                :is-character-generated="isCharacterGenerated"
                :is-companion-present="isCompanionPresent"
                @update:imagePrompt="handleUpdateImagePrompt"
                @quota-exceeded="() => handleQuotaExceeded('characterImage')"
              />
            </div>
          </div>

          <!-- Companion Panel Overlay (for screens without permanent panel) -->
          <Transition name="slide-left">
            <div v-if="!shouldShowCompanionPanel && showCompanionInfo"
                 class="fixed inset-y-0 right-0 z-50 w-80 bg-gray-800 shadow-2xl overflow-y-auto">
              <div class="p-4">
                <button @click="toggleCompanionInfo"
                        class="mb-4 w-full flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span class="text-gray-300">Close</span>
                </button>
                <CompanionInfoPanel
                  ref="companionInfoPanelRef"
                  :character-name="generatedCharacterName"
                  :character-description="generatedCharacterDescription"
                  :detailed-visual-description="generatedDetailedVisualDescription"
                  :genre="selectedGenre"
                  :image-model="selectedImageModel"
                  :relationship-level="relationshipLevel"
                  :image-key="characterImageKey"
                  :is-loading-character="isLoadingCharacter || (isLoadingAdventure && !isCharacterGenerated)"
                  :is-character-generated="isCharacterGenerated"
                  :is-companion-present="isCompanionPresent"
                  @update:imagePrompt="handleUpdateImagePrompt"
                  @quota-exceeded="() => handleQuotaExceeded('characterImage')"
                />
              </div>
            </div>
          </Transition>





          <!-- Bottom Bar: Mic Button -->
          <div v-if="isGameScreenActive" 
               class="fixed bottom-0 left-0 right-0 z-20 flex justify-center"
               :style="{paddingBottom: (isSmallScreen ? SCREEN_PADDING * 1.5 : SCREEN_PADDING) + 'px'}">

            <div class="bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl p-4">
              <div class="flex items-center justify-center">
                 <button @click="micButtonClickHandler" 
                      :disabled="isMicDisabled && waveformState !== 'systemSpeaking'"
                      :class="{
                          'bg-gray-600 cursor-not-allowed': (isMicDisabled && waveformState !== 'systemSpeaking') || isNarrating,
                          'bg-green-600 hover:bg-green-700 animate-pulse-ring': !isMicDisabled && waveformState === 'idle' && !isNarrating,
                          'bg-red-500 hover:bg-red-600': (waveformState === 'systemSpeaking' || waveformState === 'userSpeaking') && !isNarrating
                      }"
                      class="relative button rounded-full flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-all duration-200 ease-in-out"
                      :aria-label="isNarrating ? 'Narrator speaking' : (waveformState === 'systemSpeaking' || waveformState === 'userSpeaking' ? 'Stop conversation' : 'Start or resume conversation')">
                  
                  <div class="absolute flex items-end h-3/5 w-3/5 justify-center opacity-75" 
                       :class="{'filter grayscale': (isMicDisabled || waveformState === 'narrating' || waveformState === 'loading') && !isNarrating}">
                      <template v-if="waveformState === 'userSpeaking' && !isNarrating">
                          <div v-for="(value, i) in [...(liveAudioRef?.userWaveformData || [])].reverse().slice(0,4)" :key="'user-'+i" class="w-1 sm:w-1.5 bg-white rounded-full mx-0.5 animate-wave" :style="{ height: \`\${value * 70 + 30}%\`, animationDelay: (i * 0.1) + 's' }"></div>
                          <div v-for="(value, i) in (liveAudioRef?.userWaveformData || []).slice(0,4)" :key="'user2-'+i" class="w-1 sm:w-1.5 bg-white rounded-full mx-0.5 animate-wave" :style="{ height: \`\${value * 70 + 30}%\`, animationDelay: (i * 0.1 + 0.05) + 's' }"></div>
                      </template>
                      <template v-else-if="waveformState === 'systemSpeaking' || waveformState === 'narrating' || waveformState === 'connecting'">
                          <div v-for="(value, i) in [...(liveAudioRef?.systemWaveformData || [])].reverse().slice(0,4)" :key="'sys-'+i" class="w-1 sm:w-1.5 bg-purple-300 rounded-full mx-0.5 animate-wave" :style="{ height: \`\${value * 70 + 30}%\`, animationDelay: (i * 0.1) + 's' }"></div>
                          <div v-for="(value, i) in (liveAudioRef?.systemWaveformData || []).slice(0,4)" :key="'sys2-'+i" class="w-1 sm:w-1.5 bg-purple-300 rounded-full mx-0.5 animate-wave" :style="{ height: \`\${value * 70 + 30}%\`, animationDelay: (i * 0.1 + 0.05) + 's' }"></div>
                      </template>
                      <template v-else-if="waveformState === 'loading'">
                           <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s] mx-0.5"></div>
                           <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s] mx-0.5"></div>
                           <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce mx-0.5"></div>
                      </template>
                       <template v-else> 
                          <div v-for="i in 8" :key="'idle-'+i" class="w-1 sm:w-1.5 bg-gray-400 rounded-full mx-0.5" style="height: 20%;"></div>
                      </template>
                  </div>
                  
                  <svg v-if="isNarrating" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 sm:h-8 sm:h-8 relative z-10 text-yellow-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>
                  <svg v-else-if="waveformState === 'systemSpeaking' || waveformState === 'userSpeaking'" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 sm:h-8 sm:h-8 relative z-10 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                  <svg v-else class="w-7 h-7 sm:w-8 sm:h-8 relative z-10 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
              </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      
      <LiveAudioComponent 
        ref="liveAudioRef"
        @no-audio="handleNoAudio"
        @speaking-start="handleSpeakingStart"
        @extended-quiet="handleExtendedQuiet"
        @quota-exceeded="() => handleQuotaExceeded('dialog')"
        @invalid-voice="handleInvalidVoiceError"
        @user-text="handleUserText"
        @companion-text="handleCompanionText"
      />

      <ShareModal 
        :is-visible="showShareModal" 
        :share-url="currentShareUrl"
        :is-copied="isCopied"
        @close="showShareModal = false"
        @copy-url="copyShareUrl"
      />
      <RawPromptsModal 
        :is-visible="showRawModal"
        :character-generation-prompt="actualCharacterGenerationLLMPrompt"
        :voice-prompt="actualVoicePrompt"
        :character-image-prompt="actualCharacterImagePrompt"
        :scene-image-prompt="initialSceneImagePrompt"
        :scene-narration-prompt="rawSceneNarrationLLMPrompt"
        @close="showRawModal = false"
      />
    </div>
  `
})

createApp(ImagineOrchestrator).mount('#app');