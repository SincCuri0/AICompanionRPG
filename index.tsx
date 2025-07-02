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
    const conversationManager = useConversationManager(adventureState, apiKey);
    const adventureSetup = useAdventureSetup(ai, imageGeneratorService, adventureState, apiKey);


    const handleUpdateImagePrompt = (prompt: string) => {
      adventureState.actualCharacterImagePrompt.value = prompt;
    };
    
    // This handler remains but the button is removed from main UI
    const handleRegenerateCompanionImage = () => {
        if(companionInfoPanelRef.value) {
            companionInfoPanelRef.value.triggerRegenerateImage();
        }
    };
    
    const triggerInteractiveSession = async () => {
        await nextTick(); 
        conversationManager.onStartOrResumeAdventure();
    };

    const handleUserText = async (text: string) => {
      if (text.trim()) {
        await conversationManager.handleTextInput(text.trim());
      }
    };

    const handleCompanionText = (text: string) => {
      // This is now handled automatically by the conversation manager
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


    return {
      // State and computed from adventureState
      ...adventureState,
      
      // UI state and methods from appUI
      ...appUI,

      // Adventure setup methods
      handleStartAdventureSetup: () => {
        // Set game screen active immediately, so loading happens on the game screen
        adventureState.isGameScreenActive.value = true; 
        // Ensure body overflow is handled correctly for game screen
        if (appUI.isSmallScreen.value) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = 'hidden'; // Also for large screen during game
        }
        adventureSetup.handleStartAdventureSetup(triggerInteractiveSession);
      },
      handleRegenerateSceneImage: adventureSetup.handleRegenerateSceneImage, // Handler remains, button removed
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
      handleTriggerContextualChange: conversationManager.handleTriggerContextualChange, // Handler remains, button removed
      
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
      handleRegenerateCompanionImage, // Handler remains, button removed

      isMicDisabled,
      waveformState,
      micButtonClickHandler,
    };
  },
  template: `
    <div id="imagine-orchestrator" class="w-full min-h-screen flex flex-col transition-all duration-500 ease-in-out"
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
        <div v-if="isGameScreenActive" class="w-full h-full flex flex-col flex-grow">
          
          <!-- Main Content Area (Desktop: Row, Mobile: Column structure) -->
          <div class="flex-grow flex flex-col lg:flex-row gap-3 lg:gap-4 p-2 lg:p-5" 
               :style="{paddingBottom: (isSmallScreen ? 200 : SCREEN_PADDING + 80) + 'px'}">
            
            <!-- Main Story and Conversation Window -->
            <div class="flex-grow order-1 lg:w-3/4 flex items-stretch">
              <SceneDisplayPanel 
                class="h-full"
                :scene-image-url="initialSceneImageUrl"
                :scene-narration="initialSceneNarration"
                :is-narrating="isNarrating"
                :is-loading="isLoadingScene && (!initialSceneImageUrl || !initialSceneNarration) || (isLoadingAdventure && !isCharacterGenerated && !isSceneDataReady)"
                :chat-history="chatHistory"
                :companion-name="generatedCharacterName"
              />
            </div>

            <!-- Right Sidebar (Desktop visible, Mobile toggled) -->
            <div class="lg:w-1/4 xl:w-[380px] shrink-0 order-2 flex flex-col gap-3 lg:gap-4 lg:pt-0"
                 :class="{
                   'hidden lg:flex': !showMobileSidebar && isSmallScreen, 
                   'fixed inset-y-0 right-0 z-40 w-3/4 max-w-xs sm:max-w-sm bg-gray-900/95 backdrop-blur-md p-4 shadow-xl transform transition-transform duration-300 ease-in-out lg:static lg:transform-none lg:bg-transparent lg:p-0 lg:shadow-none': showMobileSidebar && isSmallScreen,
                   'lg:flex': !isSmallScreen
                 }">
                <div v-if="showMobileSidebar && isSmallScreen" class="flex justify-end lg:hidden mb-2">
                    <button @click="showMobileSidebar = false" class="p-2 text-gray-300 hover:text-white" aria-label="Close sidebar">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
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
                  @update:imagePrompt="handleUpdateImagePrompt"
                  @quota-exceeded="() => handleQuotaExceeded('characterImage')"
                />
                <!-- Model Selectors, Voice Guide, Action Buttons for Share/Prompts/Regen are removed from here -->
            </div>
          </div>
          
          <!-- Overlay for mobile sidebar -->
          <div v-if="showMobileSidebar && isSmallScreen" @click="showMobileSidebar = false" class="fixed inset-0 bg-black/60 z-30 lg:hidden"></div>

          <!-- Mobile Sidebar Toggle Button -->
          <button v-if="isSmallScreen && isGameScreenActive && !showMobileSidebar" @click="showMobileSidebar = !showMobileSidebar"
                  class="fixed top-4 right-4 z-50 p-2 bg-gray-700/80 text-white rounded-full shadow-lg lg:hidden"
                  aria-label="Open sidebar">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"></path></svg>
          </button>

          <!-- Bottom Bar: Floating Message and Mic Button -->
          <div v-if="isGameScreenActive" 
               class="fixed bottom-0 left-0 right-0 z-20 flex flex-col items-center"
               :style="{paddingBottom: (isSmallScreen ? SCREEN_PADDING * 1.5 : SCREEN_PADDING) + 'px'}">
            
            <Transition name="fade">
              <div v-if="floatingMessageText && floatingMessageText.length > 0 && waveformState !== 'userSpeaking'"
                   class="w-full max-w-md xl:max-w-xl text-center px-3 py-1.5 mb-2 text-xs sm:text-sm rounded-md shadow"
                   :class="{
                     'bg-yellow-600/90 text-yellow-50': isNarrating,
                     'bg-purple-600/90 text-purple-50': waveformState === 'systemSpeaking' || waveformState === 'connecting',
                     'bg-gray-700/90 text-gray-100': waveformState === 'idle' && !isNarrating && !isConnectingAudio,
                     'bg-gray-600/90 text-gray-200': waveformState === 'loading'
                   }">
                {{ floatingMessageText }}
              </div>
            </Transition>

            <div class="bg-gray-800 rounded-lg shadow-xl p-3 sm:p-4">
              <div class="flex items-center justify-center my-1 sm:my-2">
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
              <!-- Share, Prompts, Regen, Contextual buttons removed -->
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
      <!-- Old floating message div is removed, integrated with mic bar area -->
    </div>
  `
})

createApp(ImagineOrchestrator).mount('#app');