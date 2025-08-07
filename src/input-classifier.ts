/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GroqService, cleanJsonResponse } from './groq-service';

export interface InputClassification {
  type: 'navigation' | 'dialogue' | 'examination';
  confidence: number;
  intent: string;
  shouldGenerateScene: boolean;
}

export class InputClassifier {
  private groqService: GroqService;

  constructor(groqApiKey: string) {
    this.groqService = new GroqService(groqApiKey);
  }

  async classifyInput(userInput: string, hasCompanion: boolean = false): Promise<InputClassification> {
    // If companion is present, default to dialogue unless clearly navigation
    if (hasCompanion && !this.isObviousNavigation(userInput)) {
      return {
        type: 'dialogue',
        confidence: 0.8,
        intent: 'Talk to companion',
        shouldGenerateScene: false
      };
    }

    try {
      const prompt = `Classify this user input for an adventure game:
"${userInput}"

Is this:
1. navigation - moving to a new location (walk, go, move, enter, etc.)
2. examination - looking at something closely (look, examine, inspect, etc.)  
3. dialogue - talking or social interaction (say, ask, tell, hello, etc.)

Respond with JSON:
{
  "type": "navigation|examination|dialogue",
  "confidence": 0.9,
  "intent": "brief description",
  "shouldGenerateScene": true/false
}

Navigation and some examinations should generate new scenes.`;

      const response = await this.groqService.generateResponse(
        "You are a precise input classifier. Always respond with valid JSON only.",
        prompt,
        true
      );

      const result = JSON.parse(cleanJsonResponse(response));
      return {
        type: result.type,
        confidence: result.confidence || 0.7,
        intent: result.intent || userInput,
        shouldGenerateScene: result.shouldGenerateScene || (result.type === 'navigation')
      };

    } catch (error) {
      console.error('[InputClassifier] Failed to classify, using fallback:', error);
      return this.fallbackClassification(userInput);
    }
  }

  private isObviousNavigation(input: string): boolean {
    const navWords = ['go', 'walk', 'move', 'enter', 'exit', 'leave', 'head', 'travel'];
    const lowerInput = input.toLowerCase();
    return navWords.some(word => lowerInput.includes(word));
  }

  private fallbackClassification(userInput: string): InputClassification {
    const input = userInput.toLowerCase();
    
    if (this.isObviousNavigation(input)) {
      return {
        type: 'navigation',
        confidence: 0.7,
        intent: 'Move to new location',
        shouldGenerateScene: true
      };
    }
    
    if (input.includes('look') || input.includes('examine') || input.includes('inspect')) {
      return {
        type: 'examination',
        confidence: 0.7,
        intent: 'Examine something',
        shouldGenerateScene: false
      };
    }
    
    return {
      type: 'dialogue',
      confidence: 0.6,
      intent: 'Social interaction',
      shouldGenerateScene: false
    };
  }
}
