/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, PropType } from 'vue';
import { Genre } from '../ai-data-types';

export default defineComponent({
  props: {
    genres: {
      type: Array as PropType<Genre[]>,
      required: true,
    },
    selectedGenre: {
      type: String as PropType<Genre | ''>,
      required: true,
    },
    isConnecting: { // True when character generation is in progress
      type: Boolean,
      required: true,
    },
    isGenreSelected: {
      type: Boolean,
      required: true,
    },
    selectionPrompt: { // Prompt message for the button area
        type: String,
        required: true,
    }
  },
  emits: ['genre-selected', 'generate-character'],
  setup(props, { emit }) {
    const selectGenre = (genre: Genre) => {
      emit('genre-selected', genre);
    };

    const generateCharacter = () => {
      emit('generate-character');
    };

    return {
      selectGenre,
      generateCharacter,
    };
  },
  template: `
    <div class="lg:w-[60%] w-full flex flex-col items-center lg:items-start p-4 lg:p-0">
      <div class="lg:w-4/5 w-full flex items-center justify-center lg:justify-start -mb-4 lg:mb-7 lg:ml-24">
        <h1 class="text-3xl lg:text-5xl font-bold text-center lg:text-left my-4 lg:my-0 text-white">Interactive AI Adventure</h1>
      </div>

      <!-- Genre Selection -->
      <div class="flex flex-col lg:items-start items-center w-full lg:w-auto lg:ml-24 mt-8 lg:mt-0">
        <div class="text-2xl lg:text-4xl my-4 lg:my-0 lg:mb-5 self-center lg:self-start text-gray-100">Select Your Adventure's Genre</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 lg:gap-4 lg:w-[calc(350px+70px)] w-full max-w-lg">
          <button v-for="genre in genres" :key="genre"
                  @click="selectGenre(genre)"
                  :class="['p-3 lg:p-4 rounded-xl text-lg lg:text-xl font-semibold transition-all duration-200 ease-in-out',
                           selectedGenre === genre ? 'bg-green-600 text-white ring-2 ring-green-300 scale-105' : 'bg-gray-700 hover:bg-gray-600 text-gray-100']"
                  role="button" :aria-pressed="selectedGenre === genre">
            {{ genre }}
          </button>
        </div>
      </div>

      <!-- Generate Character & Start Button -->
      <div class="w-full lg:ml-24 flex justify-center lg:justify-start mt-10 lg:mt-12">
        <button id="generateCharacterButton" @click="generateCharacter"
                :disabled="!isGenreSelected || isConnecting"
                class="lg:w-[350px] w-full max-w-md text-xl lg:text-2xl font-semibold button bg-blue-600 text-white rounded-2xl py-4 px-6 flex items-center justify-center cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-70">
          <svg v-if="isConnecting" class="animate-spin h-7 w-7 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-7 h-7 mr-3" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2.14c1.72.45 3 2 3 3.86 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86V7zm0 6.17c1.03 0 1.83-.81 1.83-1.83S13.03 9.5 12 9.5s-1.83.81-1.83 1.83S10.97 13.17 11 13.17zM11 5h2v2h-2V5z"/>
          </svg>
          {{ isConnecting ? 'Generating...' : 'Generate Character & Start' }}
        </button>
      </div>
       <div v-if="!isGenreSelected || (isGenreSelected && !isConnecting && selectionPrompt !== 'Ready for an adventure!')" class="w-full lg:ml-24 text-center lg:text-left mt-4 text-gray-400">
            {{ selectionPrompt }}
        </div>
    </div>
  `,
});
