/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { defineComponent, ref, onMounted, onUnmounted, watch } from 'vue';
import { GoogleGenAI } from '@google/genai';
import { ImageGeneratorService } from '../image-generator-service';
import { buildImagePrompt, buildImageDescriptionFromPromptLLMPrompt } from '../prompt-builder';
import { DEFAULT_IMAGE_MODEL } from '../ai-config';
import { Genre } from '../ai-data-types';

const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

export default defineComponent({
  props: {
    detailedVisualDescription: { type: String, required: true },
    model: { type: String, default: DEFAULT_IMAGE_MODEL },
    genre: { type: String as () => Genre | '', required: true },
  },
  emits: ['update:imagePrompt', 'quota-exceeded'],
  setup(props, { emit }) {
    const imageUrl = ref('');
    const imageFallbackText = ref('');
    const status = ref('');
    const isLoading = ref(false);
    const errorMessage = ref('');
    let imageGeneratorService: ImageGeneratorService;
    let ai: GoogleGenAI;

    const initializeServices = () => {
      try {
        if (!imageGeneratorService) {
          imageGeneratorService = new ImageGeneratorService(process.env.API_KEY!);
        }
        if (!ai) {
          ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        }
      } catch (e) {
        console.error("Error initializing services in CharacterImage:", e);
        const serviceName = !imageGeneratorService ? "ImageGeneratorService" : "GoogleGenAI";
        errorMessage.value = `Failed to initialize ${serviceName}: ${e instanceof Error ? e.message : String(e)}`;
        throw e;
      }
    };

    const checkKeyPixels = (imageData: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error("Failed to get 2D context for image check.");
            resolve(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          const keyPixels = [
            { x: 0, y: 0 }, { x: img.width - 1, y: 0 }, { x: Math.floor(img.width / 2), y: 0 },
            { x: 0, y: img.height - 1 }, { x: img.width - 1, y: img.height - 1 }, { x: Math.floor(img.width / 2), y: img.height - 1 }
          ];

          for (const pixel of keyPixels) {
            const pixelData = ctx.getImageData(pixel.x, pixel.y, 1, 1).data;
            const hasContent = pixelData[0] <= 250 || pixelData[1] <= 250 || pixelData[2] <= 250;
            if (hasContent) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        };
        img.onerror = (e) => {
            console.error("Error loading image for pixel check:", e);
            resolve(false);
        }
        img.src = imageData;
      });
    };
    
    const generateImage = async () => {
      if (!props.detailedVisualDescription || !props.genre) {
          isLoading.value = false;
          status.value = "Detailed visual description or genre not provided.";
          console.warn("generateImage called without detailedVisualDescription or genre prop.");
          return;
      }
      try {
        initializeServices();
      } catch (initError) {
        isLoading.value = false;
        status.value = "Error initializing services.";
        return;
      }
      isLoading.value = true;
      status.value = 'Generating...';
      imageUrl.value = '';
      imageFallbackText.value = '';
      errorMessage.value = '';

      const imagePrompt = buildImagePrompt(
        props.detailedVisualDescription,
        props.genre as Genre
      );
      emit('update:imagePrompt', imagePrompt);

      try {
        const response = await imageGeneratorService.generate(props.model, imagePrompt, { numberOfImages: 3, outputMimeType: 'image/jpeg' });

        // Handle new response format with candidates[0].content.parts
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts && parts.length > 0) {
          let foundValidImage = false;
          let lastSrc = '';
          
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || 'image/jpeg';
              const src = `data:${mimeType};base64,${part.inlineData.data}`;
              lastSrc = src;
              // eslint-disable-next-line no-await-in-loop
              const hasContent = await checkKeyPixels(src);
              if (hasContent) {
                imageUrl.value = src;
                status.value = 'Done!';
                foundValidImage = true;
                break;
              } else {
                console.warn("Generated image was considered blank after pixel check.");
              }
            }
          }
          
          if (!foundValidImage && lastSrc) {
            imageUrl.value = lastSrc;
            status.value = 'Generated image might be blank, using last attempt.';
            console.warn("No clearly valid image found, using the last generated image.");
          } else if (!foundValidImage) {
             console.error('No valid image data received or all images were blank.');
             throw new Error('No valid image data received or all images were blank.');
          }
        } else {
          console.error('No image data received. Response:', response);
          throw new Error('No image data received.');
        }
      } catch (e) {
        const primaryErrorMsg = e instanceof Error ? e.message : 'Unknown image generation error.';
        console.error("Image generation error:", primaryErrorMsg, e);
        
        // Store error message first
        if (primaryErrorMsg.includes('RESOURCE_EXHAUSTED') || primaryErrorMsg.includes('429')) {
          errorMessage.value = 'Companion image quota exceeded with primary model.';
          emit('quota-exceeded');
        } else if (primaryErrorMsg.includes("SAFETY")) {
          errorMessage.value = "Companion image failed primary safety policies.";
        } else {
          errorMessage.value = `Companion image failed: ${primaryErrorMsg.substring(0, 100)}`;
        }
        imageUrl.value = ''; // Ensure no broken image attempts to load

        // Attempt fallback to Gemini for text description
        console.log("Attempting Gemini fallback for character image description.");
        status.value = 'Fallback: Describing...';
        try {
            const fallbackPrompt = buildImageDescriptionFromPromptLLMPrompt(imagePrompt, props.genre as Genre);
            const fallbackResponse = await ai.models.generateContent({
                model: FALLBACK_GEMINI_MODEL,
                contents: fallbackPrompt,
            });
            imageFallbackText.value = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Unable to generate description';
            status.value = 'Fallback description generated.';
            errorMessage.value = ''; // Clear primary error if fallback succeeds
        } catch (fallbackError) {
            const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error.';
            console.error("Gemini fallback for character image description failed:", fallbackErrorMsg, fallbackError);
            // Keep the original Image error message if fallback also fails
            errorMessage.value = `Primary failed: ${errorMessage.value.substring(0,50)}. Fallback also failed: ${fallbackErrorMsg.substring(0,50)}`;
            imageFallbackText.value = '';
        }

      } finally {
        isLoading.value = false;
      }
    };

    onMounted(async () => {
      try {
        initializeServices();
      } catch (e) {
        return; // Error already set by initializeServices
      }
      if (props.detailedVisualDescription && props.genre) {
        await generateImage();
      }
    });

    watch(() => [props.detailedVisualDescription, props.model, props.genre], async () => {
        if (props.detailedVisualDescription && props.genre) {
            await generateImage();
        }
    }, {deep: true});


    onUnmounted(() => {
      if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(imageUrl.value);
        } catch (e) {
            console.warn("Error revoking object URL:", e);
        }
      }
    });
    
    const triggerGenerateImage = async () => {
        await generateImage();
    };


    return {
      imageUrl,
      imageFallbackText,
      status,
      isLoading,
      errorMessage,
      triggerGenerateImage
    };
  },
  template: `
    <div class="relative w-full aspect-square flex items-center justify-center rounded-lg overflow-hidden bg-gray-700 p-2">
      <div v-if="errorMessage && !imageFallbackText" class="absolute top-1 left-1 right-1 z-30 text-red-300 bg-red-800/80 p-1.5 rounded text-xs text-center leading-tight">{{ errorMessage }}</div>
      <div v-show="isLoading" class="absolute z-20 inset-0 flex flex-col items-center justify-center bg-gray-800/70 backdrop-blur-sm">
        <div class="relative w-10 h-10 mb-1">
          <div class="absolute inset-0 border-4 border-gray-500/50 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div class="text-xs text-gray-300">{{ status }}</div>
      </div>
      
      <img v-if="imageUrl && !isLoading" class="transform scale-100 w-full h-full object-contain transition-opacity duration-500 opacity-100" :src="imageUrl" alt="Generated Character"/>
      
      <div v-else-if="imageFallbackText && !isLoading" class="w-full h-full flex items-center justify-center p-2">
        <p class="text-xs text-gray-300 text-center leading-snug italic">{{ imageFallbackText }}</p>
      </div>
      
      <div v-if="!imageUrl && !imageFallbackText && !isLoading && !errorMessage" class="text-gray-400 text-sm">Image will appear here</div>
    </div>
  `
});
