/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GroqService, cleanJsonResponse } from './groq-service';
import { VOICE_OPTIONS } from './ai-data';
import { Genre } from './ai-data-types';

export interface GameState {
    genre: Genre;
    currentScene: string;
    chatHistory: Array<{ sender: 'user' | 'companion'; text: string; imageUrl?: string }>;
    isCompanionPresent: boolean;
    companionName?: string;
    companionDescription?: string;
    worldSetting: string;
    recentSceneElements: string[];
}

export interface StoryWeaverDecision {
    responseType: 'exploration' | 'dialogue_attempt' | 'companion_dialogue' | 'companion_introduction' | 'examination';
    reasoning: string;
    shouldGenerateImage: boolean;
    narratorVoice: string;
    responseText?: string;
    imagePrompt?: string;
    companionFirstWords?: string;
}

export class StoryWeaverService {
    private groqService: GroqService;

    constructor(groqApiKey: string) {
        this.groqService = new GroqService(groqApiKey);
    }

    async decideResponse(userInput: string, gameState: GameState): Promise<StoryWeaverDecision> {
        try {
            console.log('[StoryWeaver] Analyzing user input:', userInput);
            
            const availableVoiceNames = VOICE_OPTIONS.map(v => v.name);
            const recentHistory = gameState.chatHistory.slice(-3).map(msg => 
                `${msg.sender === 'user' ? 'Player' : 'Narrator'}: ${msg.text}`
            ).join('\n');

            const prompt = `You are the Story Weaver, the dungeon master of an interactive ${gameState.genre} adventure. 
Your role is to analyze player input and decide how the story should respond to maintain narrative flow and engagement.

CURRENT GAME STATE:
- Genre: ${gameState.genre}
- Current Scene: ${gameState.currentScene}
- Companion Present: ${gameState.isCompanionPresent}
- Companion Name: ${gameState.companionName || 'None'}
- World Setting: ${gameState.worldSetting}
- Recent Scene Elements: ${gameState.recentSceneElements.join(', ') || 'None'}

RECENT CONVERSATION:
${recentHistory || 'Adventure just beginning'}

PLAYER INPUT: "${userInput}"

Analyze this input and decide the most appropriate narrative response. Consider:
1. What is the player trying to do? (explore, talk, examine, etc.)
2. Does this input make sense in the current context?
3. What would create the most engaging story progression?
4. Should this trigger a scene change, dialogue, or examination?

RESPONSE TYPES:
- exploration: Player is moving/exploring, generate new scene with image (shouldGenerateImage: true)
- dialogue_attempt: Player trying to talk but no one present, acknowledge attempt (shouldGenerateImage: false)
- companion_dialogue: Player talking to present companion (shouldGenerateImage: false)
- companion_introduction: Time to introduce the companion character (shouldGenerateImage: true)
- examination: Player examining something in current scene. Use shouldGenerateImage: true if the examination reveals significant new visual details, locations, or objects that would benefit from an image. Use shouldGenerateImage: false for simple observations.

Respond with JSON:
{
  "responseType": "exploration|dialogue_attempt|companion_dialogue|companion_introduction|examination",
  "reasoning": "Brief explanation of why this response type was chosen",
  "shouldGenerateImage": true/false,
  "narratorVoice": "voice_name_from_list",
  "responseText": "The actual narrative response (for dialogue_attempt/examination types)",
  "imagePrompt": "Image prompt if shouldGenerateImage is true",
  "companionFirstWords": "What companion says when introduced (companion_introduction only)"
}

IMPORTANT:
- Set shouldGenerateImage to true for exploration and companion_introduction
- For examination: set shouldGenerateImage to true if the player discovers something visually significant (new objects, hidden areas, detailed clues, etc.), false for simple observations
- Set shouldGenerateImage to false for dialogue_attempt and companion_dialogue

Available narrator voices: ${availableVoiceNames.join(', ')}

IMPORTANT: Choose responseType based on narrative logic, not just input classification. Consider story pacing and engagement.`;

            const response = await this.groqService.generateResponse(
                "You are a master storyteller and dungeon master. Always respond with valid JSON only.",
                prompt,
                true,
                {
                    useCreativeModel: true,
                    temperature: 0.8
                }
            );

            const decision = JSON.parse(cleanJsonResponse(response));
            
            // Validate and set defaults
            const validResponseTypes = ['exploration', 'dialogue_attempt', 'companion_dialogue', 'companion_introduction', 'examination'];
            if (!validResponseTypes.includes(decision.responseType)) {
                decision.responseType = 'exploration';
            }

            if (!availableVoiceNames.includes(decision.narratorVoice)) {
                decision.narratorVoice = availableVoiceNames[Math.floor(Math.random() * availableVoiceNames.length)];
            }

            // Ensure correct shouldGenerateImage setting and imagePrompt
            if (decision.responseType === 'exploration' || decision.responseType === 'companion_introduction') {
                decision.shouldGenerateImage = true;
            } else if (decision.responseType === 'examination') {
                // Keep the AI's decision for examination images
                // decision.shouldGenerateImage is already set by the AI
            } else {
                decision.shouldGenerateImage = false;
            }

            // Ensure imagePrompt is provided when image should be generated
            if (decision.shouldGenerateImage && !decision.imagePrompt) {
                if (decision.responseType === 'exploration') {
                    decision.imagePrompt = `A mysterious ${gameState.genre.toLowerCase()} scene showing the area the player is exploring, atmospheric and detailed`;
                } else if (decision.responseType === 'companion_introduction') {
                    decision.imagePrompt = `${gameState.companionDescription} appearing in ${gameState.currentScene}, ${gameState.genre.toLowerCase()} style`;
                } else if (decision.responseType === 'examination') {
                    decision.imagePrompt = `Close-up view of what the player is examining in ${gameState.currentScene}, ${gameState.genre.toLowerCase()} style, detailed and atmospheric`;
                }
            }

            // Clear imagePrompt if no image should be generated
            if (!decision.shouldGenerateImage) {
                decision.imagePrompt = "";
            }

            console.log('[StoryWeaver] Decision made:', {
                type: decision.responseType,
                reasoning: decision.reasoning,
                voice: decision.narratorVoice,
                shouldGenerateImage: decision.shouldGenerateImage,
                hasImagePrompt: !!decision.imagePrompt,
                hasResponseText: !!decision.responseText
            });

            return decision;

        } catch (error) {
            console.error('[StoryWeaver] Failed to make decision, using fallback:', error);
            return this.fallbackDecision(userInput, gameState);
        }
    }

    private fallbackDecision(userInput: string, gameState: GameState): StoryWeaverDecision {
        const availableVoiceNames = VOICE_OPTIONS.map(v => v.name);
        const randomVoice = availableVoiceNames[Math.floor(Math.random() * availableVoiceNames.length)];
        
        // Simple fallback logic
        const input = userInput.toLowerCase();
        
        if (gameState.isCompanionPresent) {
            return {
                responseType: 'companion_dialogue',
                reasoning: 'Companion is present, defaulting to dialogue',
                shouldGenerateImage: false,
                narratorVoice: randomVoice
            };
        }
        
        if (input.includes('hello') || input.includes('hi') || input.includes('say') || input.includes('talk')) {
            return {
                responseType: 'dialogue_attempt',
                reasoning: 'Player attempting dialogue with no one present',
                shouldGenerateImage: false,
                narratorVoice: randomVoice,
                responseText: `Your voice echoes through ${gameState.currentScene || 'the mysterious space'}, but there's no one here to answer. The silence that follows feels heavy with unspoken secrets.`
            };
        }

        if (input.includes('look') || input.includes('examine') || input.includes('inspect')) {
            return {
                responseType: 'examination',
                reasoning: 'Player examining current scene',
                shouldGenerateImage: false,
                narratorVoice: randomVoice,
                responseText: `You take a closer look around ${gameState.currentScene || 'your surroundings'}. The details become clearer, revealing subtle mysteries waiting to be uncovered.`
            };
        }
        
        return {
            responseType: 'exploration',
            reasoning: 'Default to exploration for unknown input',
            shouldGenerateImage: true,
            narratorVoice: randomVoice
        };
    }

    async generateExplorationResponse(userAction: string, gameState: GameState): Promise<{
        narrationText: string;
        imagePrompt?: string;
    }> {
        try {
            const recentHistory = gameState.chatHistory.slice(-2).map(msg => 
                `${msg.sender === 'user' ? 'Player' : 'Narrator'}: ${msg.text}`
            ).join('\n');

            const recentElementsText = gameState.recentSceneElements.length > 0
                ? `\nRecent scene elements to avoid repeating: ${gameState.recentSceneElements.join(', ')}`
                : '';

            const prompt = `You are crafting the next scene in a ${gameState.genre} adventure story.

CURRENT CONTEXT:
- World Setting: ${gameState.worldSetting}
- Current Scene: ${gameState.currentScene}
- Player Action: ${userAction}${recentElementsText}

RECENT STORY:
${recentHistory}

Create a compelling scene that PROGRESSES the story. The player's action should lead to discovery, change, or advancement.

Respond with JSON:
{
  "narrationText": "2-4 sentences describing what happens next, written in second person (you/your)",
  "imagePrompt": "Detailed visual description for image generation of the new scene"
}

Focus on:
- Clear progression from current situation
- New elements, locations, or discoveries
- Compelling mysteries, dangers, or phenomena
- Environmental storytelling and atmosphere`;

            const response = await this.groqService.generateResponse(
                "You are a creative storyteller crafting immersive adventure scenes.",
                prompt,
                true,
                {
                    useCreativeModel: true,
                    temperature: 1.1
                }
            );

            return JSON.parse(cleanJsonResponse(response));

        } catch (error) {
            console.error('[StoryWeaver] Failed to generate exploration response:', error);
            return {
                narrationText: `You ${userAction.toLowerCase()}. The path leads you to a new area filled with mystery and possibility.`
            };
        }
    }

    async generateCompanionIntroduction(userInput: string, gameState: GameState): Promise<{
        narrationText: string;
        imagePrompt: string;
        companionFirstWords: string;
    }> {
        try {
            const prompt = `You are introducing the companion character in a ${gameState.genre} adventure.

CONTEXT:
- Current Scene: ${gameState.currentScene}
- World Setting: ${gameState.worldSetting}
- Companion: ${gameState.companionName} - ${gameState.companionDescription}
- Player just said: "${userInput}"

Create a dramatic companion introduction that feels natural and engaging.

Respond with JSON:
{
  "narrationText": "2-3 sentences describing how the companion appears/is discovered",
  "imagePrompt": "Visual description showing the companion meeting scene",
  "companionFirstWords": "What the companion says or does when they first interact"
}`;

            const response = await this.groqService.generateResponse(
                "You are a creative storyteller crafting character introductions.",
                prompt,
                true,
                {
                    useCreativeModel: true,
                    temperature: 1.0
                }
            );

            return JSON.parse(cleanJsonResponse(response));

        } catch (error) {
            console.error('[StoryWeaver] Failed to generate companion introduction:', error);
            return {
                narrationText: `Suddenly, ${gameState.companionName} emerges from the shadows, their presence both unexpected and somehow inevitable.`,
                imagePrompt: `${gameState.companionDescription} appearing in ${gameState.currentScene}`,
                companionFirstWords: `"I've been waiting for you."`
            };
        }
    }
}
