/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, ref, watch, PropType, nextTick } from 'vue';
import type { ChatMessage } from '../composables/useAdventureState'; // Import ChatMessage type

export default defineComponent({
  props: {
    sceneImageUrl: { type: String, default: '' },
    sceneNarration: { type: String, default: '' },
    isNarrating: { type: Boolean, default: false }, // To potentially style narration text while being read
    isLoading: { type: Boolean, default: false }, // To show loading state for image/narration
    chatHistory: { type: Array as PropType<ChatMessage[]>, default: () => [] },
    companionName: { type: String, default: 'Companion' },
  },
  setup(props) {
    const isNarrationExpanded = ref(true);
    const narrationKey = ref(0); // Used to force re-render of narration if content changes
    const chatContainerRef = ref<HTMLElement | null>(null);

    const toggleNarration = () => {
      isNarrationExpanded.value = !isNarrationExpanded.value;
    };

    watch(() => props.sceneNarration, () => {
        isNarrationExpanded.value = true; // Expand on new narration
        narrationKey.value++; // Force re-render if needed for reactivity on dynamic class
    });

    watch(() => props.chatHistory, async (newHistory, oldHistory) => {
      if (newHistory.length > (oldHistory?.length || 0)) {
        await nextTick();
        if (chatContainerRef.value) {
          chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
        }
      }
    }, { deep: true });


    return {
      isNarrationExpanded,
      toggleNarration,
      narrationKey,
      chatContainerRef,
    };
  },
  template: `
    <div class="w-full flex flex-col bg-gray-800 rounded-lg shadow-xl relative h-full overflow-hidden">
      <!-- Unified Conversation Flow -->
      <div ref="chatContainerRef" class="w-full flex-grow overflow-y-auto p-4 space-y-4">
        
        <!-- Scene Image as first message -->
        <div class="w-full flex justify-center">
          <div class="w-full max-w-2xl aspect-[16/10] rounded-lg overflow-hidden bg-gray-700 shadow-inner relative">
            <div v-if="isLoading && !sceneImageUrl" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-700/80 z-10">
              <div class="relative w-12 h-12 mb-2">
                  <div class="absolute inset-0 border-4 border-gray-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div class="text-gray-400">Loading scene image...</div>
            </div>
            <img v-if="sceneImageUrl" :src="sceneImageUrl" alt="Current Adventure Scene" class="w-full h-full object-cover transition-opacity duration-500 ease-in-out" :class="{'opacity-0': isLoading && !sceneImageUrl, 'opacity-100': !isLoading && sceneImageUrl}"/>
            <div v-if="!sceneImageUrl && !isLoading" class="w-full h-full flex items-center justify-center text-gray-500">
              Scene image will appear here.
            </div>
          </div>
        </div>

        <!-- Scene Narration as narrator message -->
        <div v-if="sceneNarration || isLoading" class="flex justify-start">
          <div class="max-w-[85%] p-3 rounded-xl shadow bg-purple-600/20 border border-purple-500/30 text-gray-100">
            <div class="font-semibold text-xs mb-2 opacity-80 text-purple-300">Narrator</div>
            <div v-if="isLoading && !sceneNarration" class="text-center text-gray-400 animate-pulse">
              Loading narration...
            </div>
            <div v-if="sceneNarration && !isLoading" :key="narrationKey"
                class="text-sm lg:text-base leading-relaxed transition-all duration-300 ease-in-out"
                :class="[isNarrationExpanded ? 'expanded-text' : 'collapsed-text', {'ring-1 ring-purple-400': isNarrating}]"
                @click="toggleNarration"
                role="button"
                tabindex="0"
                aria-expanded="isNarrationExpanded"
                aria-live="polite">
              <p>{{ sceneNarration }}</p>
            </div>
          </div>
        </div>

        <!-- Chat Messages -->
        <div v-for="message in chatHistory" :key="message.id" class="flex" :class="message.sender === 'user' ? 'justify-end' : 'justify-start'">
          <div 
            class="max-w-[80%] p-2.5 rounded-xl shadow" 
            :class="message.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-600 text-gray-100 rounded-bl-none'">
            <div class="font-semibold text-xs mb-1 opacity-80">{{ message.sender === 'user' ? 'You' : (companionName || 'Companion') }}</div>
            <p class="text-sm whitespace-pre-wrap break-words">{{ message.text }}</p>
          </div>
        </div>
        
        <div v-if="chatHistory.length === 0 && !sceneNarration && !isLoading" class="text-center text-gray-500 text-sm pt-4">
            Your adventure will begin here.
        </div>
      </div>
    </div>
  `
});