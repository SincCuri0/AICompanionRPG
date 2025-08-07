/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, ref, watch, PropType, nextTick, onMounted } from 'vue';
import type { ChatMessage } from '../composables/useAdventureState'; // Import ChatMessage type

export default defineComponent({
  props: {
    isLoading: { type: Boolean, default: false }, // To show loading state for image/narration
    chatHistory: { type: Array as PropType<ChatMessage[]>, default: () => [] },
    companionName: { type: String, default: 'Companion' },
    isExplorationMode: { type: Boolean, default: false },
  },
  setup(props) {
    const chatContainerRef = ref<HTMLElement | null>(null);

    const scrollToBottom = async () => {
      await nextTick();
      if (chatContainerRef.value) {
        chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
      }
    };

    watch(() => props.chatHistory, async (newHistory, oldHistory) => {
      if (newHistory.length > (oldHistory?.length || 0)) {
        // Scroll immediately
        await scrollToBottom();

        // Also scroll after a short delay to ensure content is fully rendered
        setTimeout(async () => {
          await scrollToBottom();
        }, 100);
      }
    }, { deep: true });

    // Also scroll when messages are updated (for narration state changes, etc.)
    watch(() => props.chatHistory.map(msg => msg.isNarrating), async () => {
      await scrollToBottom();
    }, { deep: true });

    // Scroll to bottom on mount if there are existing messages
    onMounted(async () => {
      if (props.chatHistory.length > 0) {
        await scrollToBottom();
      }
    });

    return {
      chatContainerRef,
    };
  },
  template: `
    <div class="w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl relative h-full overflow-hidden border border-gray-700/50">
      <!-- Unified Conversation Flow -->
      <div ref="chatContainerRef" class="w-full flex-grow overflow-y-auto p-4 lg:p-6 space-y-6 lg:space-y-8 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">

        <!-- Chat Messages -->
        <div v-for="message in chatHistory" :key="message.id" class="flex animate-fade-in" :class="message.sender === 'user' ? 'justify-end' : 'justify-start'">

          <!-- User Message -->
          <div v-if="message.sender === 'user'" class="max-w-[80%] lg:max-w-[70%]">
            <div class="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-md shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-500/30">
              <!-- User Header -->
              <div class="px-4 py-2 border-b border-blue-500/30">
                <div class="flex items-center space-x-2">
                  <div class="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
                  <span class="font-semibold text-sm text-blue-100">You</span>
                </div>
              </div>

              <!-- User Message Content -->
              <div class="p-4">
                <p class="text-base lg:text-lg leading-relaxed whitespace-pre-wrap break-words">
                  {{ message.text }}
                </p>
              </div>
            </div>
          </div>

          <!-- Companion/System Message -->
          <div v-else class="w-full max-w-5xl">
            <div class="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl rounded-bl-md shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-600/40"
                 :class="[
                   isExplorationMode
                     ? 'ring-1 ring-purple-500/30 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-500/40'
                     : ''
                 ]">

              <!-- Companion Header (if not exploration mode) -->
              <div v-if="!isExplorationMode" class="px-4 py-3 border-b border-gray-600/40">
                <div class="flex items-center space-x-3">
                  <div class="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <span class="font-semibold text-sm text-gray-300">{{ companionName }}</span>
                </div>
              </div>

              <!-- Image (if present) -->
              <div v-if="message.imageUrl" class="p-4" :class="{'pt-4': !isExplorationMode, 'pt-6': isExplorationMode}">
                <div class="w-full max-w-3xl mx-auto aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-600/50">
                  <img :src="message.imageUrl" alt="Scene Image" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                </div>
              </div>

              <!-- Message Text -->
              <div class="p-4 lg:p-6" :class="{'pt-6': !message.imageUrl && isExplorationMode, 'pt-4': !message.imageUrl && !isExplorationMode, 'pt-0': message.imageUrl}">
                <div class="relative">
                  <p class="text-base lg:text-lg leading-relaxed whitespace-pre-wrap break-words text-gray-100"
                     :class="{
                       'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/40 rounded-xl p-4 shadow-lg ring-1 ring-purple-400/30 animate-pulse-subtle': message.isNarrating,
                       'text-gray-200': !message.isNarrating
                     }">
                    {{ message.text }}
                  </p>

                  <!-- Narrating indicator -->
                  <div v-if="message.isNarrating" class="absolute -top-2 -right-2">
                    <div class="bg-purple-500 text-white text-xs px-2 py-1 rounded-full shadow-lg animate-bounce">
                      Speaking...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-start animate-fade-in">
          <div class="w-full max-w-5xl">
            <div class="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm rounded-2xl rounded-bl-md shadow-xl border border-purple-500/40 ring-1 ring-purple-500/30">
              <div class="p-6 lg:p-8">
                <div class="flex items-center space-x-4">
                  <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                  </div>
                  <span class="text-purple-300 text-lg font-medium">Weaving your story...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="chatHistory.length === 0 && !isLoading" class="flex justify-center items-center h-64">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
              <div class="w-8 h-8 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full animate-pulse"></div>
            </div>
            <p class="text-gray-400 text-lg font-medium">Your adventure awaits...</p>
            <p class="text-gray-500 text-sm mt-2">Start speaking or typing to begin your journey</p>
          </div>
        </div>
      </div>
    </div>
  `
});