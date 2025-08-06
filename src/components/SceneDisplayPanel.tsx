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
    <div class="w-full flex flex-col bg-gray-800 rounded-lg shadow-xl relative h-full overflow-hidden">
      <!-- Unified Conversation Flow -->
      <div ref="chatContainerRef" class="w-full flex-grow overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">

        <!-- Chat Messages -->
        <div v-for="message in chatHistory" :key="message.id" class="flex" :class="message.sender === 'user' ? 'justify-end' : 'justify-center'">
          <div
            class="rounded-xl shadow-lg"
            :class="[
              message.sender === 'user'
                ? 'max-w-[75%] bg-blue-600 text-white rounded-br-none'
                : 'w-full max-w-4xl ' + (isExplorationMode ? 'bg-purple-600/20 border border-purple-500/30 text-gray-100' : 'bg-gray-600 text-gray-100 rounded-bl-none')
            ]">

            <!-- Message Header -->
            <div v-if="message.sender === 'user'" class="p-3 lg:p-4 pb-2">
              <div class="font-semibold text-sm mb-2 opacity-90">
                You
              </div>
            </div>

            <!-- Image (if present) -->
            <div v-if="message.imageUrl" class="px-3 lg:px-4 pb-3" :class="{'pt-3 lg:pt-4': message.sender !== 'user'}">
              <div class="w-full max-w-2xl mx-auto aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-lg">
                <img :src="message.imageUrl" alt="Scene Image" class="w-full h-full object-cover"/>
              </div>
            </div>

            <!-- Message Text -->
            <div class="px-3 lg:px-4 pb-3 lg:pb-4" :class="{'pt-3 lg:pt-4': message.sender !== 'user' && !message.imageUrl, 'pt-0': message.imageUrl}">
              <p class="text-base lg:text-lg leading-relaxed whitespace-pre-wrap break-words"
                 :class="{'ring-2 ring-purple-400 rounded-lg p-3': message.isNarrating}">
                {{ message.text }}
              </p>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center">
          <div class="w-full max-w-4xl p-4 lg:p-6 rounded-xl shadow-lg bg-purple-600/20 border border-purple-500/30 text-gray-100">
            <div class="text-center text-gray-400 animate-pulse text-lg">
              Loading...
            </div>
          </div>
        </div>

        <div v-if="chatHistory.length === 0 && !isLoading" class="text-center text-gray-500 text-lg pt-8">
            Your adventure will begin here.
        </div>
      </div>
    </div>
  `
});