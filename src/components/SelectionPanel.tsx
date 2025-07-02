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
    <div class="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen p-6">
      <!-- Title Section -->
      <div class="text-center mb-12">
        <h1 class="text-4xl lg:text-6xl font-bold text-white mb-4" style="background: linear-gradient(90deg, #a855f7, #ec4899, #ef4444); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: white;">
          Interactive AI Adventure
        </h1>
        <p class="text-xl lg:text-2xl text-gray-300 font-light">
          Embark on a journey limited only by your imagination
        </p>
      </div>

      <!-- Genre Selection -->
      <div class="w-full max-w-3xl">
        <h2 class="text-2xl lg:text-3xl font-semibold text-center text-white mb-8">
          Choose Your Adventure Genre
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 justify-items-center">
          <button v-for="genre in genres" :key="genre"
                  @click="selectGenre(genre)"
                  :class="[
                    'w-full max-w-xs p-4 lg:p-6 rounded-2xl text-lg lg:text-xl font-semibold transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl border-2',
                    selectedGenre === genre 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400 shadow-lg shadow-green-500/25 scale-105' 
                      : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-gray-100 border-slate-600 hover:border-slate-500 shadow-lg hover:shadow-slate-500/25'
                  ]"
                  role="button" :aria-pressed="selectedGenre === genre">
            <div class="flex items-center justify-center h-full">
              {{ genre }}
            </div>
          </button>
        </div>
      </div>

      <!-- Generate Character & Start Button -->
      <div class="w-full max-w-md mx-auto mt-12">
        <button id="generateCharacterButton" @click="generateCharacter"
                :disabled="!isGenreSelected || isConnecting"
                class="w-full text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl py-4 px-8 flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
          <svg v-if="isConnecting" class="animate-spin h-7 w-7 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-7 h-7 mr-3" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2.14c1.72.45 3 2 3 3.86 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86V7zm0 6.17c1.03 0 1.83-.81 1.83-1.83S13.03 9.5 12 9.5s-1.83.81-1.83 1.83S10.97 13.17 11 13.17zM11 5h2v2h-2V5z"/>
          </svg>
          {{ isConnecting ? 'Generating...' : 'Generate Character & Start' }}
        </button>
        <div v-if="!isGenreSelected || (isGenreSelected && !isConnecting && selectionPrompt !== 'Ready for an adventure!')" class="text-center mt-6 text-gray-400 text-lg">
          {{ selectionPrompt }}
        </div>
      </div>
    </div>
  `,
});
