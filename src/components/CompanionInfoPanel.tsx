/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, ref, watch, PropType } from 'vue';
import CharacterImage from './CharacterImage.tsx';
import { Genre } from '../ai-data-types';

export default defineComponent({
  name: 'CompanionInfoPanel',
  components: {
    CharacterImage,
  },
  props: {
    characterName: { type: String, default: '' },
    characterDescription: { type: String, default: '' },
    detailedVisualDescription: { type: String, default: '' },
    genre: { type: String as () => Genre | '', default: '' },
    imageModel: { type: String, required: true },
    relationshipLevel: { type: Number, default: 50 },
    imageKey: { type: String, required: true }, // For CharacterImage :key
    isLoadingCharacter: { type: Boolean, default: false },
    isCharacterGenerated: { type: Boolean, default: false },
  },
  emits: ['update:imagePrompt', 'quota-exceeded'],
  setup(props, { emit }) {
    const characterImageRef = ref<InstanceType<typeof CharacterImage> | null>(null);

    const triggerRegenerateImage = () => {
      if (characterImageRef.value) {
        characterImageRef.value.triggerGenerateImage();
      }
    };

    const handleImagePromptUpdate = (prompt: string) => {
      emit('update:imagePrompt', prompt);
    };

    const handleQuotaExceeded = () => {
      emit('quota-exceeded');
    };

    return {
      characterImageRef,
      triggerRegenerateImage,
      handleImagePromptUpdate,
      handleQuotaExceeded,
    };
  },
  template: `
    <div class="bg-gray-800 rounded-lg shadow-xl p-3 sm:p-4">
      <div v-if="isLoadingCharacter && !isCharacterGenerated" class="text-center text-gray-400 py-8">
        <div class="animate-pulse">Generating companion...</div>
      </div>
      <div v-else-if="!isCharacterGenerated && !isLoadingCharacter" class="text-center text-gray-400 py-8">
        Companion details will appear here.
      </div>
      <div v-else>
        <div class="w-full flex items-start mb-3 space-x-3">
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-gray-700">
            <CharacterImage
              ref="characterImageRef"
              :key="imageKey"
              :detailed-visual-description="detailedVisualDescription"
              :genre="genre"
              :model="imageModel"
              @update:imagePrompt="handleImagePromptUpdate"
              @quota-exceeded="handleQuotaExceeded"
            />
          </div>
          <div class="flex-grow min-w-0">
              <h3 class="text-lg sm:text-xl font-bold text-white truncate" :title="characterName">{{ characterName || 'Companion' }}</h3>
              <p class="text-xs text-gray-400 italic whitespace-normal break-words" :title="characterDescription">{{ characterDescription }}</p>
          </div>
        </div>
        <div>
          <label for="relationshipBar" class="block text-xs font-medium text-gray-300 mb-1">Relationship:</label>
          <div id="relationshipBar" class="w-full bg-gray-600 rounded-full h-2.5" role="progressbar" :aria-valuenow="relationshipLevel" aria-valuemin="0" aria-valuemax="100" :aria-label="'Relationship level with ' + (characterName || 'Companion') + ' is ' + relationshipLevel + '%'">
            <div class="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-in-out" :style="{ width: relationshipLevel + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  `
});