/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ref, Ref, watch } from 'vue';
import { ConversationService, ConversationConfig } from '../conversation-service';
import { audioEventBus } from '../audio-event-bus';
import { GroqService } from '../groq-service';
import { ImageGeneratorService } from '../image-generator-service';
import { NarrationService } from '../narration-service';
import { StoryWeaverService, GameState } from '../story-weaver-service';
import { buildSceneNarrationLLMPrompt } from '../prompt-builder';
import { VOICE_OPTIONS } from '../ai-data';
import type { useAdventureState } from './useAdventureState';

type AdventureState = ReturnType<typeof useAdventureState>;

export function useConversationManager(
    state: AdventureState,
    apiKey: string,
    liveAudioRef: Ref<any>
) {
    const {
        isCharacterGenerated, isNarrating, isLoadingAdventure, selectedGenre,
        generatedCharacterName, generatedCharacterDescription, generatedCoreTrait,
        generatedMainWant, generatedKeyFlaw, generatedMood, generatedStyle,
        generatedVoicePromptInstruction, AIGeneratedVoiceName, selectedVoiceId,
        currentContextualMood, currentContextualStyle,
        chatHistory, isExplorationMode, companionDiscovered, explorationCount,
        selectedImageModel
    } = state;

    const conversationService = new ConversationService(apiKey);
    const groqService = new GroqService(process.env.GROQ_API_KEY!);
    const imageGeneratorService = new ImageGeneratorService(apiKey);
    const narrationService = new NarrationService(apiKey);
    const storyWeaver = new StoryWeaverService(process.env.GROQ_API_KEY!);

    // World consistency tracking
    const worldSetting = ref<string>('');
    const currentLocationDescription = ref<string>('');
    const recentSceneElements = ref<string[]>([]); // Track recent elements to avoid repetition

    // Simplified companion system
    const isCompanionPresent = ref<boolean>(false);
    const userResponseCount = ref<number>(0);
    const companionAppearanceThreshold = ref<number>(Math.floor(Math.random() * 5) + 1); // Random 1-5

    console.log(`[ConversationManager] Companion will appear after ${companionAppearanceThreshold.value} user responses`);

    // Helper function to build current game state for Story Weaver
    const buildGameState = (): GameState => {
        return {
            genre: selectedGenre.value,
            currentScene: currentLocationDescription.value || "the beginning of your adventure",
            chatHistory: chatHistory.value.map(msg => ({
                sender: msg.sender,
                text: msg.text,
                imageUrl: msg.imageUrl
            })),
            isCompanionPresent: isCompanionPresent.value,
            companionName: generatedCharacterName.value,
            companionDescription: generatedCharacterDescription.value,
            worldSetting: worldSetting.value || "an unknown realm",
            recentSceneElements: recentSceneElements.value
        };
    };

    const isListening = ref(false);
    const isProcessing = ref(false);
    const isSpeaking = ref(false);
    const isConnectingAudio = ref(false);
    const conversationMessage = ref('');

    // JSON Schema for structured scene generation
    const sceneGenerationSchema = {
        type: "object",
        properties: {
            narrationText: {
                type: "string",
                description: "2-4 sentences describing what the player discovers, written in second person with compelling intrigue"
            },
            narratorVoiceName: {
                type: "string",
                enum: VOICE_OPTIONS.map(v => v.name),
                description: "Voice name from the available list"
            },
            imagePrompt: {
                type: "string",
                description: "Detailed visual description of the scene maintaining world consistency"
            }
        },
        required: ["narrationText", "narratorVoiceName", "imagePrompt"],
        additionalProperties: false
    };

    // Generate companion introduction scene
    const generateCompanionIntroduction = async (userInput: string): Promise<{
        narrationText: string;
        narratorVoice: string;
        imageUrl?: string;
        companionFirstWords: string;
    }> => {
        try {
            console.log('[ConversationManager] Generating companion introduction for:', userInput);

            // Build prompt for companion introduction
            const prompt = `You are generating a companion introduction scene for an interactive adventure game.

CONTEXT:
- Genre: ${selectedGenre.value}
- User's last action: "${userInput}"
- Companion name: ${generatedCharacterName.value}
- Companion description: ${generatedCharacterDescription.value}
- Companion trait: ${generatedCoreTrait.value}
- Current location: ${currentLocationDescription.value || 'Unknown location'}

TASK: Generate a companion introduction that includes:
1. A narrative description of how the companion appears/is discovered
2. The companion's first words or action when they meet the player

REQUIREMENTS:
- The introduction should feel natural and connected to the user's action
- Include visual details for image generation
- The companion should speak in modern, easily understandable language
- Make it engaging and set up future interaction

Respond with valid JSON in this exact format:
{
  "narrationText": "Narrative description of the companion's appearance/discovery",
  "imagePrompt": "Detailed visual description for image generation showing the companion meeting scene",
  "narratorVoiceName": "Aoede",
  "companionFirstWords": "What the companion says or does when they first interact"
}`;

            const response = await groqService.generateResponse(prompt, 1.1);
            const sceneData = JSON.parse(response);

            // Generate image
            let imageUrl: string | undefined;
            try {
                const imageResponse = await imageGeneratorService.generate(
                    selectedImageModel.value,
                    sceneData.imagePrompt,
                    { numberOfImages: 1, outputMimeType: 'image/jpeg' }
                );

                const parts = imageResponse.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 0) {
                    const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
                    if (imagePart) {
                        const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
                        imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
                    }
                }
            } catch (imageError) {
                console.warn('[ConversationManager] Companion intro image generation failed:', imageError);
            }

            return {
                narrationText: sceneData.narrationText,
                imageUrl: imageUrl,
                narratorVoice: sceneData.narratorVoiceName || 'Aoede',
                companionFirstWords: sceneData.companionFirstWords
            };

        } catch (error) {
            console.error('[ConversationManager] Failed to generate companion introduction:', error);
            throw error;
        }
    };

    // Handle dialogue attempts when no companion is present
    const handleSoloDialogue = async (userInput: string): Promise<{
        narrationText: string;
        narratorVoice: string;
    }> => {
        const availableVoiceNames = VOICE_OPTIONS.map(v => v.name);
        const randomVoice = availableVoiceNames[Math.floor(Math.random() * availableVoiceNames.length)];

        // Generate contextual response based on the current scene
        const currentScene = currentLocationDescription.value || "this mysterious place";

        const responses = [
            `Your voice echoes through ${currentScene}, but there's no one here to answer. The silence that follows feels heavy with unspoken secrets.`,
            `You speak into the emptiness, your words swallowed by the atmosphere of ${currentScene}. Only the ambient sounds respond to your call.`,
            `Your greeting hangs in the air unanswered. In ${currentScene}, you remain alone with your thoughts and the mysteries that surround you.`,
            `The words leave your lips, but ${currentScene} offers no companion to hear them. Perhaps someone—or something—is listening from the shadows.`,
            `You call out, hoping for a response, but ${currentScene} keeps its secrets. Your voice fades into the ambient sounds around you.`
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        return {
            narrationText: randomResponse,
            narratorVoice: randomVoice
        };
    };

    // Generate new exploration scene
    const generateExplorationScene = async (userAction: string): Promise<{
        narrationText: string;
        narratorVoice: string;
        imageUrl?: string;
    }> => {
        try {
            console.log('[ConversationManager] Generating exploration scene for:', userAction);

            const availableVoiceNames = VOICE_OPTIONS.map(v => v.name);

            // Initialize world setting from first scene if not set
            if (!worldSetting.value && chatHistory.value.length > 0) {
                const firstNarratorMessage = chatHistory.value.find(msg => msg.sender === 'companion');
                if (firstNarratorMessage) {
                    worldSetting.value = firstNarratorMessage.text;
                    currentLocationDescription.value = firstNarratorMessage.text;
                }
            }

            // Build progressive world context that avoids repetition
            const narratorMessages = chatHistory.value.filter(msg => msg.sender === 'companion');

            // Use only the most recent scene as current context, not all recent messages
            const currentSceneContext = currentLocationDescription.value || "You are beginning your adventure.";

            // Get user actions to understand progression
            const recentUserActions = chatHistory.value
                .filter(msg => msg.sender === 'user')
                .slice(-2) // Last 2 user actions for context
                .map(msg => msg.text)
                .join(', ');

            // Build context that emphasizes progression and change
            const recentElementsText = recentSceneElements.value.length > 0
                ? `\nRecent scene elements to avoid repeating: ${recentSceneElements.value.join(', ')}`
                : '';

            const worldContext = `Initial setting: ${worldSetting.value}
Current situation: ${currentSceneContext}
Recent player actions: ${recentUserActions || 'just beginning the adventure'}${recentElementsText}`;

            // Create a more creative, less instructional prompt that emphasizes progression
            const creativePrompt = `You're crafting an immersive ${selectedGenre.value} adventure scene. The player just ${userAction.toLowerCase()}.

${worldContext}

IMPORTANT: Create a NEW scene that PROGRESSES the story. Do NOT repeat or rehash the current situation. The player's action should lead to discovery, change, or advancement.

Describe what happens next and what the player discovers. Write in second person (you/your), focusing on the SITUATION and ENVIRONMENT.

Guidelines:
- Show clear progression from the current situation
- Introduce new elements, locations, or discoveries
- Create compelling mysteries, dangers, or phenomena
- Avoid repeating previous scene elements
- Focus on what changes or what is newly revealed

Examples of good progressive scenes:
- Your action reveals a hidden passage behind the bookshelf, leading to chambers unknown
- The sound you heard leads you to discover signs of recent activity - someone else has been here
- Your investigation uncovers evidence of what happened here, pointing toward a deeper mystery

Focus on advancing the story and revealing new aspects of the world.`;

            const response = await groqService.generateResponse(
                "You are a creative storyteller crafting immersive adventure scenes.",
                creativePrompt,
                false, // Don't use basic JSON mode
                {
                    useStructuredOutput: true,
                    jsonSchema: sceneGenerationSchema,
                    useCreativeModel: true,
                    temperature: 1.1 // High creativity
                }
            );

            const sceneData = JSON.parse(response);

            // Generate scene image
            let imageUrl: string | undefined;
            try {
                const imageResponse = await imageGeneratorService.generate(
                    selectedImageModel.value,
                    sceneData.imagePrompt,
                    { numberOfImages: 1, outputMimeType: 'image/jpeg' }
                );

                const parts = imageResponse.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 0) {
                    const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
                    if (imagePart) {
                        const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
                        imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
                    }
                }
            } catch (imageError) {
                console.warn('[ConversationManager] Scene image generation failed:', imageError);
            }

            // Update world state tracking
            currentLocationDescription.value = sceneData.narrationText;

            // Extract and track key location elements from the new scene to avoid repetition
            const locationKeywords = sceneData.narrationText.toLowerCase()
                .match(/\b(chamber|room|corridor|passage|library|tunnel|cave|forest|building|tower|basement|attic|garden|courtyard|bridge|path|road|street|alley|plaza|square|market|temple|church|castle|fortress|dungeon|crypt|tomb|vault|archive|laboratory|study|office|kitchen|bedroom|hall|gallery|balcony|terrace|roof|cellar|warehouse|factory|mill|mine|quarry|pit|well|spring|pond|lake|river|stream|creek|waterfall|cliff|mountain|hill|valley|plain|desert|swamp|marsh|bog|meadow|field|grove|thicket|clearing|ruins)\b/g) || [];

            // Keep only the last 5 location elements to avoid the list growing too large
            recentSceneElements.value = [...new Set([...recentSceneElements.value, ...locationKeywords])].slice(-5);

            return {
                narrationText: sceneData.narrationText,
                narratorVoice: sceneData.narratorVoiceName,
                imageUrl
            };

        } catch (error) {
            console.error('[ConversationManager] Failed to generate exploration scene:', error);

            // Fallback scene
            return {
                narrationText: `You ${userAction.toLowerCase()}. The path leads you to a new area filled with mystery and possibility.`,
                narratorVoice: 'Charon',
                imageUrl: undefined
            };
        }
    };

    // Watch audio state changes and control STT accordingly
    watch(() => audioEventBus.state.value, (newState, oldState) => {
        if (!newState.isSTTActive && newState.isTTSPlaying) {
            // Pause STT during TTS
            if (isListening.value) {
                conversationService.pauseListening();
            }
        } else if (newState.isSTTActive && !newState.isTTSPlaying && oldState?.isTTSPlaying) {
            // Resume STT after TTS ends (only if TTS was previously playing)
            setTimeout(async () => {
                if (isCharacterGenerated.value && !isNarrating.value && !isLoadingAdventure.value) {
                    await startListening();
                }
            }, 1000);
        }
    }, { deep: true });

    const buildConversationConfig = (): ConversationConfig => {
        console.log('[ConversationManager] Building config with selectedVoiceId:', selectedVoiceId.value);
        return {
            characterName: generatedCharacterName.value,
            characterDescription: generatedCharacterDescription.value,
            voiceName: AIGeneratedVoiceName.value,
            voiceId: selectedVoiceId.value,
            genre: selectedGenre.value?.name || 'adventure',
            coreTrait: generatedCoreTrait.value,
            mainWant: generatedMainWant.value,
            keyFlaw: generatedKeyFlaw.value,
            voicePromptInstruction: generatedVoicePromptInstruction.value,
            currentMood: currentContextualMood.value || generatedMood.value,
            currentStyle: currentContextualStyle.value || generatedStyle.value
        };
    };

    const startListening = async (): Promise<void> => {
        if (!conversationService.isSTTSupported()) {
            throw new Error('Speech recognition is not supported in this browser');
        }

        if (isListening.value || isProcessing.value || isSpeaking.value || isNarrating.value) {
            console.warn('Cannot start listening: audio playback in progress or already listening');
            return;
        }

        try {
            isListening.value = true;
            conversationMessage.value = 'Listening... Speak now!';

            // Use simple press-to-record approach
            const userInput = await conversationService.startListening();
            
            if (userInput && userInput.trim()) {
                conversationMessage.value = 'Processing your speech...';
                await processUserInput(userInput);
            } else {
                console.warn('No speech detected or empty input received');
                conversationMessage.value = 'No speech detected. Please speak clearly and try again.';
                setTimeout(() => {
                    conversationMessage.value = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Listening failed:', error);
            conversationMessage.value = 'Could not hear you. Please try again.';
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        } finally {
            isListening.value = false;
        }
    };

    const stopListening = (): void => {
        if (isListening.value) {
            conversationService.stopListening();
            isListening.value = false;
            conversationMessage.value = '';
        }
    };

    // Execute Story Weaver decisions
    const executeStoryWeaverDecision = async (decision: any, userInput: string, gameState: GameState): Promise<void> => {
        switch (decision.responseType) {
            case 'companion_introduction':
                await handleCompanionIntroduction(decision, userInput, gameState);
                break;
            case 'exploration':
                await handleExploration(decision, userInput, gameState);
                break;
            case 'dialogue_attempt':
                await handleDialogueAttempt(decision);
                break;
            case 'examination':
                await handleExamination(decision);
                break;
            case 'companion_dialogue':
                await handleCompanionDialogue(userInput);
                break;
            default:
                console.warn('[ConversationManager] Unknown decision type:', decision.responseType);
                await handleExploration(decision, userInput, gameState);
        }
    };

    const handleCompanionIntroduction = async (decision: any, userInput: string, gameState: GameState): Promise<void> => {
        console.log('[ConversationManager] Introducing companion');
        isCompanionPresent.value = true;
        conversationMessage.value = 'Introducing companion...';

        try {
            const companionIntro = await storyWeaver.generateCompanionIntroduction(userInput, gameState);

            // Add narrator introduction
            const narratorMessage = {
                id: chatHistory.value.length + 1,
                sender: 'companion' as const,
                text: companionIntro.narrationText,
                imageUrl: decision.shouldGenerateImage ? await generateSceneImage(companionIntro.imagePrompt) : undefined,
                isNarrating: false
            };
            chatHistory.value.push(narratorMessage);

            // Play narration
            await playNarration(narratorMessage, companionIntro.narrationText, decision.narratorVoice);

            // Add companion's first words
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'companion',
                text: companionIntro.companionFirstWords
            });

        } catch (error) {
            console.error('[ConversationManager] Failed to generate companion introduction:', error);
            // Fallback
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'companion',
                text: `As you explore, you notice ${gameState.companionName} nearby. They seem to have been watching your journey.`
            });
        }
    };

    const handleExploration = async (decision: any, userInput: string, gameState: GameState): Promise<void> => {
        console.log('[ConversationManager] Generating exploration scene');
        conversationMessage.value = 'Generating new scene...';

        try {
            const explorationResponse = await storyWeaver.generateExplorationResponse(userInput, gameState);

            // Add narrator response
            const narratorMessage = {
                id: chatHistory.value.length + 1,
                sender: 'companion' as const,
                text: explorationResponse.narrationText,
                imageUrl: decision.shouldGenerateImage ? await generateSceneImage(explorationResponse.imagePrompt) : undefined,
                isNarrating: false
            };
            chatHistory.value.push(narratorMessage);

            // Update current location description
            currentLocationDescription.value = explorationResponse.narrationText;

            // Play narration
            await playNarration(narratorMessage, explorationResponse.narrationText, decision.narratorVoice);

        } catch (error) {
            console.error('[ConversationManager] Failed to generate exploration scene:', error);
            // Fallback
            const fallbackText = `You ${userInput.toLowerCase()}. The path leads you to a new area filled with mystery and possibility.`;
            const narratorMessage = {
                id: chatHistory.value.length + 1,
                sender: 'companion' as const,
                text: fallbackText,
                isNarrating: false
            };
            chatHistory.value.push(narratorMessage);
            await playNarration(narratorMessage, fallbackText, decision.narratorVoice);
        }
    };

    const handleDialogueAttempt = async (decision: any): Promise<void> => {
        console.log('[ConversationManager] Handling dialogue attempt with no companion');
        conversationMessage.value = 'Responding to your call...';

        const narratorMessage = {
            id: chatHistory.value.length + 1,
            sender: 'companion' as const,
            text: decision.responseText,
            isNarrating: false
        };
        chatHistory.value.push(narratorMessage);

        await playNarration(narratorMessage, decision.responseText, decision.narratorVoice);
    };

    const handleExamination = async (decision: any): Promise<void> => {
        console.log('[ConversationManager] Handling examination');
        conversationMessage.value = 'Looking closer...';

        const narratorMessage = {
            id: chatHistory.value.length + 1,
            sender: 'companion' as const,
            text: decision.responseText,
            isNarrating: false
        };
        chatHistory.value.push(narratorMessage);

        await playNarration(narratorMessage, decision.responseText, decision.narratorVoice);
    };

    const handleCompanionDialogue = async (userInput: string): Promise<void> => {
        console.log('[ConversationManager] Handling companion dialogue');
        const config = buildConversationConfig();
        conversationMessage.value = `${config.characterName} is thinking...`;

        try {
            // Generate response without auto-speaking
            const aiMessage = await conversationService.processUserInput(userInput, config, false);

            // Add AI response to chat history
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'companion',
                text: aiMessage.text
            });

            // Handle TTS for companion dialogue
            isSpeaking.value = true;
            conversationMessage.value = `${config.characterName} is speaking...`;
            audioEventBus.startTTS('conversation');

            if (liveAudioRef.value?.muteMicrophone) {
                liveAudioRef.value.muteMicrophone();
            }

            try {
                await conversationService.speakText(aiMessage.text, config.voiceName, config.voiceId);
            } finally {
                isSpeaking.value = false;
                if (liveAudioRef.value?.unmuteMicrophone) {
                    liveAudioRef.value.unmuteMicrophone();
                }
                audioEventBus.endTTS();
            }

        } catch (error) {
            console.error('[ConversationManager] Failed to handle companion dialogue:', error);
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'companion',
                text: "I'm not sure how to respond to that right now."
            });
        }
    };

    // Helper functions
    const generateSceneImage = async (imagePrompt?: string): Promise<string | undefined> => {
        if (!imagePrompt) return undefined;

        try {
            const imageResponse = await imageGeneratorService.generate(
                selectedImageModel.value,
                imagePrompt,
                { numberOfImages: 1, outputMimeType: 'image/jpeg' }
            );

            const parts = imageResponse.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }
        } catch (error) {
            console.warn('[ConversationManager] Image generation failed:', error);
        }

        return undefined;
    };

    const playNarration = async (narratorMessage: any, text: string, voice: string): Promise<void> => {
        try {
            conversationMessage.value = 'Narrator speaking...';
            narratorMessage.isNarrating = true;

            await narrationService.playNarration(text, voice, selectedGenre.value);

            narratorMessage.isNarrating = false;
        } catch (error) {
            console.error('[ConversationManager] Narration playback failed:', error);
            narratorMessage.isNarrating = false;
        }
    };

    const processUserInput = async (userInput: string): Promise<void> => {
        if (isProcessing.value || isSpeaking.value) {
            return;
        }

        try {
            isProcessing.value = true;
            conversationMessage.value = 'Story Weaver is thinking...';

            // Increment user response count
            userResponseCount.value++;
            console.log(`[ConversationManager] User response ${userResponseCount.value}/${companionAppearanceThreshold.value}`);

            // Build current game state
            const gameState = buildGameState();

            // Check if companion should appear based on threshold
            const shouldIntroduceCompanion = !isCompanionPresent.value && userResponseCount.value >= companionAppearanceThreshold.value;

            // Let Story Weaver decide how to respond
            const decision = await storyWeaver.decideResponse(userInput, gameState);
            console.log('[ConversationManager] Story Weaver decision:', decision.responseType, '-', decision.reasoning);

            // Override decision if companion threshold reached
            if (shouldIntroduceCompanion && decision.responseType !== 'companion_introduction') {
                console.log('[ConversationManager] Overriding decision to introduce companion');
                decision.responseType = 'companion_introduction';
                decision.reasoning = 'Companion appearance threshold reached';
            }

            // Add user message to chat history
            chatHistory.value.push({
                id: chatHistory.value.length + 1,
                sender: 'user',
                text: userInput
            });

            // Execute the Story Weaver's decision
            await executeStoryWeaverDecision(decision, userInput, gameState);



        } catch (error) {
            console.error('Failed to process user input:', error);
            conversationMessage.value = 'Sorry, I had trouble understanding. Please try again.';
            
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        } finally {
            isProcessing.value = false;
            conversationMessage.value = '';
            
            // Longer delay to avoid immediately picking up any audio tail-end
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    };

    const handleTextInput = async (text: string): Promise<void> => {
        if (text.trim()) {
            await processUserInput(text.trim());
        }
    };

    const onStartOrResumeAdventure = async (): Promise<void> => {
        if (!isCharacterGenerated.value || isNarrating.value || isLoadingAdventure.value) {
            console.warn('Cannot start conversation: adventure not ready');
            return;
        }

        // Check if audio system is currently playing TTS
        if (audioEventBus.state.value.isTTSPlaying) {
            console.log('[ConversationManager] TTS is playing, will start listening when it ends');
            return; // The watcher will start listening when TTS ends
        }

        await startListening();
    };

    const handlePlayerStopClick = (): void => {
        if (isListening.value) {
            stopListening();
        } else if (isSpeaking.value) {
            // Could implement speech interruption here if needed
            conversationMessage.value = '';
        }
    };

    const handleNoAudio = (): void => {
        conversationMessage.value = 'No microphone detected. Please check your audio settings.';
        setTimeout(() => {
            conversationMessage.value = '';
        }, 5000);
    };

    const handleSpeakingStart = (): void => {
        // Not needed for STT approach
    };

    const handleExtendedQuiet = (): void => {
        if (isListening.value) {
            stopListening();
            conversationMessage.value = 'No speech detected. Please try again.';
            setTimeout(() => {
                conversationMessage.value = '';
            }, 3000);
        }
    };

    const handleDialogQuotaExceeded = (): void => {
        console.error('Dialog quota exceeded');
        conversationMessage.value = 'Service temporarily unavailable. Please try again later.';
        setTimeout(() => {
            conversationMessage.value = '';
        }, 5000);
    };

    const handleInvalidVoiceError = (): void => {
        console.error('Invalid voice configuration');
        conversationMessage.value = 'Voice configuration error. Please restart the adventure.';
    };

    const handleTriggerContextualChange = (): void => {
        // Could implement mood/style changes here
        console.log('Contextual change triggered');
    };

    return {
        // State
        isListening,
        isProcessing,
        isSpeaking,
        isConnectingAudio,
        conversationMessage,
        
        // Methods
        onStartOrResumeAdventure,
        handlePlayerStopClick,
        handleNoAudio,
        handleSpeakingStart,
        handleExtendedQuiet,
        handleDialogQuotaExceeded,
        handleInvalidVoiceError,
        handleTriggerContextualChange,
        handleTextInput,
        
        // Service methods
        startListening,
        stopListening,
        processUserInput
    };
}