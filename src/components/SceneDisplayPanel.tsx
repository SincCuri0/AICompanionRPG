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
    const isNarrationExpanded = ref(false);
    const narrationKey = ref(0); // Used to force re-render of narration if content changes
    const chatContainerRef = ref<HTMLElement | null>(null);

    const toggleNarration = () => {
      isNarrationExpanded.value = !isNarrationExpanded.value;
    };

    watch(() => props.sceneNarration, () => {
        isNarrationExpanded.value = false; // Collapse on new narration
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
    <div class="w-full flex flex-col items-center justify-start p-4 bg-gray-800 rounded-lg shadow-xl relative h-full">
      <!-- Scene Image -->
      <div class="w-full aspect-[16/10] rounded-lg overflow-hidden bg-gray-700 mb-4 shadow-inner relative shrink-0">
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

      <!-- Scene Narration -->
       <div class="w-full shrink-0">
        <div v-if="isLoading && !sceneNarration" class="w-full p-3 bg-gray-700 rounded-md text-center text-gray-400 animate-pulse">
          Loading narration...
        </div>
        <div v-if="sceneNarration && !isLoading" :key="narrationKey"
            class="w-full p-3 bg-gray-700/80 backdrop-blur-sm rounded-md text-gray-200 text-sm lg:text-base leading-relaxed shadow transition-all duration-300 ease-in-out"
            :class="[isNarrationExpanded ? 'expanded-text' : 'collapsed-text', {'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-800': isNarrating}]"
            @click="toggleNarration"
            role="button"
            tabindex="0"
            aria-expanded="isNarrationExpanded"
            aria-live="polite">
          <p>{{ sceneNarration }}</p>
        </div>
        <div v-if="!sceneNarration && !isLoading" class="w-full p-3 bg-gray-700 rounded-md text-center text-gray-400">
          Narration will appear here.
        </div>
      </div>

      <!-- Chat History -->
      <div ref="chatContainerRef" class="mt-3 w-full flex-grow overflow-y-auto space-y-3 pr-2 pb-1">
        <div v-for="message in chatHistory" :key="message.id" class="flex" :class="message.sender === 'user' ? 'justify-end' : 'justify-start'">
          <div 
            class="max-w-[80%] p-2.5 rounded-xl shadow" 
            :class="message.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-600 text-gray-100 rounded-bl-none'">
            <div class="font-semibold text-xs mb-1 opacity-80">{{ message.sender === 'user' ? 'You' : (companionName || 'Companion') }}</div>
            <p class="text-sm whitespace-pre-wrap break-words">{{ message.text }}</p>
          </div>
        </div>
        <div v-if="chatHistory.length === 0 && !isLoading" class="text-center text-gray-500 text-sm pt-4">
            Your conversation will appear here.
        </div>
      </div>
    </div>
  `
});