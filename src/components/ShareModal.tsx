/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    isVisible: { type: Boolean, required: true },
    shareUrl: { type: String, required: true },
    isCopied: { type: Boolean, required: true },
  },
  emits: ['close', 'copy-url'],
  setup(props, { emit }) {
    const close = () => emit('close');
    const copyUrl = () => emit('copy-url');

    return { close, copyUrl };
  },
  template: `
    <div v-if="isVisible" class="font-sans fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" aria-modal="true" role="dialog" aria-labelledby="shareModalTitle">
      <div class="bg-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-[90%] mx-4 border border-gray-700">
        <div class="flex justify-between items-center mb-4">
          <h2 id="shareModalTitle" class="text-xl sm:text-2xl font-bold text-gray-100">Share Adventure Genre</h2>
          <button @click="close" class="text-gray-300 hover:text-white" aria-label="Close share modal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="mb-4">
          <input type="text" :value="shareUrl" readonly class="w-full p-2 border border-gray-600 rounded-lg bg-gray-700 text-gray-100 text-sm sm:text-base focus:ring-blue-500 focus:border-blue-500" aria-label="Shareable URL"/>
        </div>
        <button @click="copyUrl" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base">
          {{ isCopied ? 'Copied!' : 'Copy URL' }}
        </button>
      </div>
    </div>
  `
});
