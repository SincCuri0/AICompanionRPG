/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from '@google/genai';
import { DEFAULT_IMAGE_MODEL, FALLBACK_IMAGE_GENERATION_MODEL } from './ai-config';

export interface ImageConfig {
    numberOfImages?: number;
    outputMimeType?: 'image/jpeg' | 'image/png';
    responseModalities?: Modality[];
}

export class ImageGeneratorService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
     if (!apiKey) {
      throw new Error("API key is required to initialize ImageGeneratorService.");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(model: string, prompt: string, config: ImageConfig): Promise<any> {
    try {
      const response = await this.client.models.generateContent({
        model: model,
        contents: [{ text: prompt }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          ...config
        },
      });
      return response;
    } catch (e) {
      console.error(`Image generation failed with model ${model}:`, e);
      // If the initial model was the default Image model, try the Gemini image generation fallback
      if (model === DEFAULT_IMAGE_MODEL) {
        console.warn(`Attempting fallback image generation with model: ${FALLBACK_IMAGE_GENERATION_MODEL}`);
        try {
          const fallbackResponse = await this.client.models.generateContent({
            model: FALLBACK_IMAGE_GENERATION_MODEL,
            contents: [{ text: prompt }],
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
              ...config
            },
          });
          console.log(`Fallback image generation with ${FALLBACK_IMAGE_GENERATION_MODEL} successful.`);
          return fallbackResponse;
        } catch (fallbackError) {
          console.error(`Fallback image generation with model ${FALLBACK_IMAGE_GENERATION_MODEL} also failed:`, fallbackError);
          throw fallbackError; // Throw the error from the fallback attempt
        }
      }
      // If it wasn't the default model, or if fallback is not configured for it, throw the original error
      throw e;
    }
  }
}