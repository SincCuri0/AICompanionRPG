/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    isVisible: { type: Boolean, required: true },
    characterGenerationPrompt: { type: String, default: '' },
    voicePrompt: { type: String, default: '' }, // Companion's speech prompt
    characterImagePrompt: { type: String, default: '' }, // Companion's profile image prompt
    sceneImagePrompt: { type: String, default: '' }, // Main scene image prompt
    sceneNarrationPrompt: { type: String, default: '' }, // Context for how scene narration was generated
  },
  emits: ['close'],
  setup(props, { emit }) {
    const close = () => emit('close');
    return { close };
  },
  template: `
    <div v-if="isVisible" class="font-sans fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" aria-modal="true" role="dialog" aria-labelledby="rawPromptsModalTitle">
      <div class="bg-gray-800 rounded-2xl p-6 sm:p-8 max-w-4xl w-[90%] mx-4 max-h-[80vh] flex flex-col border border-gray-700">
        <div class="flex justify-between items-center mb-4">
          <h2 id="rawPromptsModalTitle" class="text-xl sm:text-2xl font-bold text-gray-100">Raw & Contextual Prompts</h2>
          <button @click="close" class="text-gray-300 hover:text-white" aria-label="Close raw prompts modal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="space-y-3 overflow-y-auto flex-1 text-xs sm:text-sm">
          <div>
            <h3 class="text-base font-semibold mb-1 text-gray-100">Character Generation LLM Prompt</h3>
            <pre class="bg-gray-700 p-2 rounded-lg overflow-x-auto text-gray-200 whitespace-pre-wrap">{{ characterGenerationPrompt || 'No character generation prompt captured yet.' }}</pre>
          </div>
          <div>
            <h3 class="text-base font-semibold mb-1 text-gray-100">Companion Profile Image Prompt</h3>
            <pre class="bg-gray-700 p-2 rounded-lg overflow-x-auto text-gray-200 whitespace-pre-wrap">{{ characterImagePrompt || 'No character image prompt generated yet.' }}</pre>
          </div>
           <div>
            <h3 class="text-base font-semibold mb-1 text-gray-100">Scene Image Prompt</h3>
            <pre class="bg-gray-700 p-2 rounded-lg overflow-x-auto text-gray-200 whitespace-pre-wrap">{{ sceneImagePrompt || 'No scene image prompt generated yet.' }}</pre>
          </div>
          <div>
            <h3 class="text-base font-semibold mb-1 text-gray-100">Scene Narration LLM Prompt Context</h3>
            <pre class="bg-gray-700 p-2 rounded-lg overflow-x-auto text-gray-200 whitespace-pre-wrap">{{ sceneNarrationPrompt || 'No scene narration prompt context captured yet.' }}</pre>
          </div>
          <div>
            <h3 class="text-base font-semibold mb-1 text-gray-100">Companion Voice Prompt (System Instruction for Live Dialog)</h3>
            <pre class="bg-gray-700 p-2 rounded-lg overflow-x-auto text-gray-200 whitespace-pre-wrap">{{ voicePrompt || 'No companion voice prompt generated yet.' }}</pre>
          </div>
        </div>
      </div>
    </div>
  `
});