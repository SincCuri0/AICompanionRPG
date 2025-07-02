

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref } from 'vue';
import { GoogleGenAI, GenerateContentResponse, Session, Modality, StartSensitivity, EndSensitivity, LiveServerMessage, SpeechConfig } from '@google/genai';
import { ImageGeneratorService } from '../image-generator-service';
import { NarrationService } from '../narration-service';
import { GroqService } from '../groq-service';

import { VOICE_OPTIONS } from '../ai-data';
import { Genre } from '../ai-data-types';
import { buildConsolidatedAdventurePrompt, buildCharacterGenerationPrompt, buildSceneImagePromptLLMPrompt, buildSceneNarrationLLMPrompt, buildNarrationSpeechPrompt, buildImageDescriptionFromPromptLLMPrompt } from '../prompt-builder';
import { voiceSelectionService } from '../voice-selection-service';
import type { useAdventureState } from './useAdventureState'; // For type inference

type AdventureState = ReturnType<typeof useAdventureState>;

const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';
const SCENE_IMAGE_FALLBACK_PREFIX = 'text_fallback:';

export function useAdventureSetup(
    ai: GoogleGenAI,
    imageGeneratorService: ImageGeneratorService,
    state: AdventureState,
    apiKey: string,
    narrationService?: NarrationService,
    groqService?: GroqService
) {
    const {
        selectedGenre,
        generatedCharacterType, generatedRole, generatedMood, generatedStyle,
        AIGeneratedVoiceName, generatedCharacterName, generatedCharacterDescription,
        generatedDetailedVisualDescription, generatedCoreTrait, generatedMainWant,
        generatedKeyFlaw, generatedVoicePromptInstruction,
        generatedGender, generatedAge, generatedAccent, selectedVoiceId,
        currentContextualMood, currentContextualStyle,
        initialSceneNarratorVoice, initialSceneImagePrompt, initialSceneImageUrl,
        initialSceneNarration, rawSceneNarrationLLMPrompt,
        isLoadingAdventure, isLoadingCharacter, isLoadingScene, isNarrating,
        isGameScreenActive, selectedDialogModel, selectedImageModel,
        actualCharacterGenerationLLMPrompt,
        isCharacterGenerated, resetFullAdventureState: _resetFullAdventureState,
        isConnectingAudio, isSceneDataReady
    } = state;

    const isSmallScreen = ref(window.innerWidth < 1024);
    const resetFullAdventureState = () => _resetFullAdventureState(isSmallScreen.value);

    // Use provided services or create new ones (for backward compatibility)
    const narratorSvc = narrationService || new NarrationService(apiKey);
    
    const groqSvc = groqService || (() => {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            throw new Error("GROQ_API_KEY environment variable is required for character generation");
        }
        return new GroqService(groqApiKey);
    })();

    const handleQuotaExceeded = (source: 'characterImage' | 'sceneImage' | 'dialog') => {
        console.warn(`[AdventureSetup] API quota exceeded from ${source}.`);
        if (source === 'dialog') {
             alert("Dialog API quota exceeded. The adventure cannot continue. Check Google Cloud project quotas.");
             resetFullAdventureState();
        } else if (source === 'characterImage') {
            console.warn("Character image generation quota exceeded. The component should display an error.");
        } else if (source === 'sceneImage') {
             console.warn("Scene image generation quota exceeded.");
        }
    };


    const handleStartAdventureSetup = async (startInteractiveCallback: () => Promise<void>) => {
        if (!selectedGenre.value) {
            alert("Please select a genre first.");
            return;
        }
        const genreToUse = selectedGenre.value;
        console.log("[AdventureSetup] Starting adventure setup for genre:", genreToUse);

        resetFullAdventureState();
        selectedGenre.value = genreToUse;

        isGameScreenActive.value = true;
        if (isSmallScreen.value) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'hidden';


        isLoadingAdventure.value = true;
        isLoadingCharacter.value = true;

        state.actualVoicePrompt.value = '';
        state.actualCharacterImagePrompt.value = '';
        const availableVoiceNames = VOICE_OPTIONS.map(v => v.name);
        actualCharacterGenerationLLMPrompt.value = buildConsolidatedAdventurePrompt(selectedGenre.value, availableVoiceNames);


        try {
            const adventureStartTime = performance.now();
            console.log("[AdventureSetup] Starting consolidated adventure generation...");
            
            // Generate ALL adventure data in one Groq call!
            const consolidatedGenStartTime = performance.now();
            
            const systemPrompt = "You are a comprehensive adventure generator for an interactive AI adventure game. Generate all character and scene data in valid JSON format with the exact structure requested.";
            const userPrompt = actualCharacterGenerationLLMPrompt.value;
            
            const consolidatedResponse = await groqSvc.generateResponse(systemPrompt, userPrompt, true);
            const consolidatedGenDuration = performance.now() - consolidatedGenStartTime;
            console.log(`[AdventureSetup] ⏱️ Consolidated adventure generation completed in ${consolidatedGenDuration.toFixed(2)}ms`);

            let jsonStrConsolidated = consolidatedResponse.trim();
            const fenceRegexConsolidated = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const matchConsolidated = jsonStrConsolidated.match(fenceRegexConsolidated);
            if (matchConsolidated && matchConsolidated[2]) jsonStrConsolidated = matchConsolidated[2].trim();
            const parsedAdventureData = JSON.parse(jsonStrConsolidated);
            console.log("[AdventureSetup] Parsed consolidated adventure data:", parsedAdventureData);

            // Extract character and scene data
            const parsedCharData = parsedAdventureData.character;
            const parsedSceneData = parsedAdventureData.scene;

            if (
                // Validate character data
                parsedCharData.characterType && typeof parsedCharData.characterType === 'string' &&
                parsedCharData.role && typeof parsedCharData.role === 'string' &&
                parsedCharData.mood && typeof parsedCharData.mood === 'string' &&
                parsedCharData.style && typeof parsedCharData.style === 'string' &&
                parsedCharData.voiceName && availableVoiceNames.includes(parsedCharData.voiceName) &&
                parsedCharData.characterName && typeof parsedCharData.characterName === 'string' &&
                parsedCharData.characterDescription && typeof parsedCharData.characterDescription === 'string' &&
                parsedCharData.detailedVisualDescription && typeof parsedCharData.detailedVisualDescription === 'string' &&
                parsedCharData.coreTrait && typeof parsedCharData.coreTrait === 'string' &&
                parsedCharData.mainWant && typeof parsedCharData.mainWant === 'string' &&
                parsedCharData.keyFlaw && typeof parsedCharData.keyFlaw === 'string' &&
                parsedCharData.voicePromptInstruction && typeof parsedCharData.voicePromptInstruction === 'string' &&
                parsedCharData.gender && typeof parsedCharData.gender === 'string' &&
                parsedCharData.age && typeof parsedCharData.age === 'string' &&
                typeof parsedCharData.accent === 'string' && // accent can be empty string
                // Validate scene data
                parsedSceneData.imagePrompt && typeof parsedSceneData.imagePrompt === 'string' &&
                parsedSceneData.narrationText && typeof parsedSceneData.narrationText === 'string' &&
                parsedSceneData.narratorVoiceName && availableVoiceNames.includes(parsedSceneData.narratorVoiceName)
            ) {
                // Set character data
                generatedCharacterType.value = parsedCharData.characterType;
                generatedRole.value = parsedCharData.role;
                generatedMood.value = parsedCharData.mood;
                generatedStyle.value = parsedCharData.style;
                AIGeneratedVoiceName.value = parsedCharData.voiceName;
                generatedCharacterName.value = parsedCharData.characterName;
                generatedCharacterDescription.value = parsedCharData.characterDescription;
                generatedDetailedVisualDescription.value = parsedCharData.detailedVisualDescription;
                generatedCoreTrait.value = parsedCharData.coreTrait;
                generatedMainWant.value = parsedCharData.mainWant;
                generatedKeyFlaw.value = parsedCharData.keyFlaw;
                generatedVoicePromptInstruction.value = parsedCharData.voicePromptInstruction;
                generatedGender.value = parsedCharData.gender;
                generatedAge.value = parsedCharData.age;
                generatedAccent.value = parsedCharData.accent;

                // Use voice selection service to pick optimal ElevenLabs voice
                const characterTraits = {
                    characterType: parsedCharData.characterType,
                    role: parsedCharData.role,
                    mood: parsedCharData.mood,
                    style: parsedCharData.style,
                    coreTrait: parsedCharData.coreTrait,
                    mainWant: parsedCharData.mainWant,
                    keyFlaw: parsedCharData.keyFlaw,
                    gender: parsedCharData.gender as 'male' | 'female' | 'neutral',
                    age: parsedCharData.age as 'young' | 'middle_aged' | 'old',
                    accent: parsedCharData.accent
                };

                const selectedElevenLabsVoiceId = voiceSelectionService.selectVoiceForCharacter(characterTraits);
                selectedVoiceId.value = selectedElevenLabsVoiceId;
                console.log("[AdventureSetup] Character traits for voice selection:", characterTraits);
                console.log("[AdventureSetup] Selected ElevenLabs voice ID:", selectedElevenLabsVoiceId);
                console.log("[AdventureSetup] selectedVoiceId.value is now:", selectedVoiceId.value);

                currentContextualMood.value = '';
                currentContextualStyle.value = '';
                isLoadingCharacter.value = false;
                console.log("[AdventureSetup] Consolidated adventure generation successful. Starting image and narration...");
                
                // Set scene data from consolidated response
                initialSceneImagePrompt.value = parsedSceneData.imagePrompt;
                initialSceneNarration.value = parsedSceneData.narrationText;
                initialSceneNarratorVoice.value = parsedSceneData.narratorVoiceName;
                rawSceneNarrationLLMPrompt.value = `Generated via consolidated prompt: ${parsedSceneData.narrationText}`;
                
                console.log("[AdventureSetup] ✅ Scene data ready:", {
                    imagePrompt: parsedSceneData.imagePrompt.substring(0, 50) + '...',
                    narrationText: parsedSceneData.narrationText.substring(0, 50) + '...',
                    narratorVoice: parsedSceneData.narratorVoiceName
                });
                
                // Start background tasks
                isLoadingScene.value = true;
                initialSceneImageUrl.value = '';
                const appBackground = document.getElementById('app-background');
                if (appBackground) appBackground.style.backgroundImage = 'none';

                // Start image generation and wait for completion before TTS
                const imgGenStartTime = performance.now();
                console.log("[AdventureSetup] Starting scene image generation...");
                const sceneImageTask = imageGeneratorService.generate(
                    selectedImageModel.value, 
                    parsedSceneData.imagePrompt, 
                    { numberOfImages: 1, outputMimeType: 'image/jpeg' }
                ).then(async (sceneImageResponse) => {
                    const parts = sceneImageResponse.candidates?.[0]?.content?.parts;
                    if (parts && parts.length > 0) {
                        const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
                        if (imagePart) {
                            const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
                            initialSceneImageUrl.value = `data:${mimeType};base64,${imagePart.inlineData.data}`;
                            if (appBackground) appBackground.style.backgroundImage = `url(${initialSceneImageUrl.value})`;
                            const imgGenDuration = performance.now() - imgGenStartTime;
                            console.log(`[AdventureSetup] ⏱️ Scene image generation completed in ${imgGenDuration.toFixed(2)}ms`);
                        }
                    }
                }).catch((imgError) => {
                    console.warn("[AdventureSetup] Scene image generation failed, using fallback:", imgError);
                    initialSceneImageUrl.value = `${SCENE_IMAGE_FALLBACK_PREFIX}Scene image could not be generated.`;
                    if (appBackground) appBackground.style.backgroundImage = 'none';
                });

                // Wait for image generation to complete, then start TTS
                sceneImageTask.finally(async () => {
                    const narrationStartTime = performance.now();
                    console.log("[AdventureSetup] Scene image ready, starting narration TTS generation...");
                    isNarrating.value = true;
                    
                    try {
                        await narratorSvc.playNarration(
                            parsedSceneData.narrationText, 
                            parsedSceneData.narratorVoiceName, 
                            selectedGenre.value
                        );
                        const narrationDuration = performance.now() - narrationStartTime;
                        console.log(`[AdventureSetup] ⏱️ Narration completed in ${narrationDuration.toFixed(2)}ms`);
                    } catch (narrationError) {
                        console.error("[AdventureSetup] Narration playback failed:", narrationError);
                    } finally {
                        isNarrating.value = false;
                    }
                });

                // Immediately activate game and start interactive session
                isLoadingScene.value = false;
                isLoadingAdventure.value = false;
                isGameScreenActive.value = true;
                if (isSmallScreen.value) document.body.style.overflow = 'hidden';
                else document.body.style.overflow = 'hidden';

                console.log("[AdventureSetup] ✅ Starting interactive session immediately...");
                await startInteractiveCallback();

                const totalDuration = performance.now() - adventureStartTime;
                console.log(`[AdventureSetup] ⏱️ Total adventure setup completed in ${totalDuration.toFixed(2)}ms (image/audio continue in background)`);
                console.log("[AdventureSetup] Image and narration will complete in background...");
            }
        } catch (imgError) {
            console.warn("[AdventureSetup] Error regenerating scene image:", imgError);
             if (imgError instanceof Error && (imgError.message.includes('RESOURCE_EXHAUSTED') || imgError.message.includes('429'))) {
                handleQuotaExceeded('sceneImage');
                 alert("Scene image regeneration failed due to API quota. Please try again later.");
            } else {
                // Attempt fallback to Gemini for text description of scene image
                console.log("[AdventureSetup] Attempting Gemini fallback for scene image regeneration description.");
                try {
                    const fallbackPrompt = buildImageDescriptionFromPromptLLMPrompt(initialSceneImagePrompt.value, selectedGenre.value as Genre);
                    const fallbackResponse = await ai.models.generateContent({
                        model: FALLBACK_GEMINI_MODEL,
                        contents: fallbackPrompt,
                    });
                    initialSceneImageUrl.value = `${SCENE_IMAGE_FALLBACK_PREFIX}${fallbackResponse.text.trim()}`;
                    console.log("[AdventureSetup] Scene image regeneration fallback description generated:", initialSceneImageUrl.value);
                    if (appBackground) appBackground.style.backgroundImage = 'none';
                } catch (fallbackError) {
                    console.error("[AdventureSetup] Gemini fallback for scene image regeneration description also failed:", fallbackError);
                    initialSceneImageUrl.value = `${SCENE_IMAGE_FALLBACK_PREFIX}Scene image could not be regenerated or described. Original prompt: ${initialSceneImagePrompt.value.substring(0,100)}...`;
                    alert("Failed to regenerate scene image with primary model and fallback. Please see console for details.");
                }
            }
        } finally {
            isLoadingScene.value = false;
        }
    };

    const handleGenreSelected = (genre: Genre) => {
      state.selectedGenre.value = genre;
      if (state.isGameScreenActive.value || state.isCharacterGenerated.value || state.isLoadingAdventure.value) {
        console.log("[AdventureSetup] Genre changed while adventure active/loading. Resetting state.");
        resetFullAdventureState();
        state.selectedGenre.value = genre;

      } else {
        console.log("[AdventureSetup] Genre selected on initial screen. No reset needed yet.");
      }
    };


    return {
        handleStartAdventureSetup,
        handleGenreSelected,
        handleQuotaExceeded
    };
}