/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GroqService } from './groq-service';
import { ElevenLabsTTSService } from './elevenlabs-tts-service';
import { STTService } from './stt-service';
import { TextCleanupService } from './text-cleanup-service';

export interface ConversationConfig {
  characterName: string;
  characterDescription: string;
  voiceName: string;
  voiceId?: string;
  genre: string;
  coreTrait: string;
  mainWant: string;
  keyFlaw: string;
  voicePromptInstruction: string;
  currentMood: string;
  currentStyle: string;
}

export interface ConversationMessage {
  id: number;
  sender: 'user' | 'companion';
  text: string;
  timestamp?: number;
}

export class ConversationService {
  private groqService: GroqService;
  private ttsService: ElevenLabsTTSService;
  private sttService: STTService;
  private chatHistory: ConversationMessage[] = [];
  private nextMessageId = 1;

  constructor(geminiApiKey: string) {
    // Use Groq API key from environment
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY environment variable is required for text generation. Add it to .env.local");
    }
    this.groqService = new GroqService(groqApiKey);
    
    // Use ElevenLabs API key from environment (defined in vite.config.ts)
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required for TTS. Add it to .env.local");
    }
    this.ttsService = new ElevenLabsTTSService(elevenLabsApiKey);
    this.sttService = new STTService();
  }

  isSTTSupported(): boolean {
    return this.sttService.isSupported();
  }

  async startListening(): Promise<string> {
    return this.sttService.startListening({
      language: 'en-US',
      continuous: true, // Allow longer speech with auto-stop
      interimResults: true // Better feedback during speech
    });
  }

  async startVoiceActivationMode(): Promise<string> {
    return this.sttService.startVoiceActivationMode();
  }

  stopListening(): void {
    this.sttService.stopListening();
    this.sttService.stopVoiceActivationMode();
  }

  getIsListening(): boolean {
    return this.sttService.getIsListening();
  }

  pauseListening(): void {
    this.sttService.pauseListening();
  }

  resumeListening(): void {
    this.sttService.resumeListening();
  }

  addMessage(sender: 'user' | 'companion', text: string): ConversationMessage {
    const message: ConversationMessage = {
      id: this.nextMessageId++,
      sender,
      text,
      timestamp: Date.now()
    };
    this.chatHistory.push(message);
    return message;
  }

  getChatHistory(): ConversationMessage[] {
    return [...this.chatHistory];
  }

  clearChatHistory(): void {
    this.chatHistory = [];
    this.nextMessageId = 1;
  }

  private buildSystemPrompt(config: ConversationConfig): string {
    return `You are ${config.characterName}, a ${config.characterDescription}.

Character traits:
- Core trait: ${config.coreTrait}
- Main want: ${config.mainWant}
- Key flaw: ${config.keyFlaw}
- Current mood: ${config.currentMood || 'neutral'}
- Current style: ${config.currentStyle || 'conversational'}

Voice instruction: ${config.voicePromptInstruction}

You are in a ${config.genre} adventure scenario. Respond to the user's input in character, staying true to your personality traits. Keep responses conversational and engaging, typically 1-3 sentences unless the situation calls for more.`;
  }

  private buildUserMessage(config: ConversationConfig, userInput: string): string {
    const recentHistory = this.chatHistory.slice(-10); // Last 10 messages for context
    
    let conversationContext = '';
    if (recentHistory.length > 0) {
      conversationContext = 'Recent conversation:\n' + 
        recentHistory.map(msg => `${msg.sender === 'user' ? 'User' : config.characterName}: ${msg.text}`).join('\n') + '\n\n';
    }

    return `${conversationContext}User: ${userInput}`;
  }

  async generateResponse(config: ConversationConfig, userInput: string): Promise<string> {
    try {
      const startTime = performance.now();
      const systemPrompt = this.buildSystemPrompt(config);
      const userMessage = this.buildUserMessage(config, userInput);
      
      console.log('[Conversation] Sending request to Groq Llama-3.1-8b-instant');
      
      const response = await this.groqService.generateResponse(systemPrompt, userMessage);
      const duration = performance.now() - startTime;
      console.log(`[Conversation] ⏱️ Response generated in ${duration.toFixed(2)}ms`);
      
      return response;
    } catch (error) {
      console.error('Failed to generate response:', error);
      throw error;
    }
  }

  async speakText(text: string, voiceName: string, voiceId?: string): Promise<void> {
    try {
      const startTime = performance.now();
      console.log('[Conversation] speakText called with voiceId:', voiceId, 'voiceName:', voiceName);
      
      // Clean text for TTS - remove stage directions and action descriptions
      let cleanedText = text;
      if (TextCleanupService.hasStageDirections(text)) {
        cleanedText = TextCleanupService.cleanForTTS(text);
        console.log('[Conversation] Text cleaned for TTS - removed stage directions');
      }

      if (voiceId && voiceId.trim() !== '') {
        // Use ElevenLabs voice ID for character dialogue
        console.log('[Conversation] Using ElevenLabs voice ID for character:', voiceId);
        await this.ttsService.speakTextWithVoiceId(cleanedText, voiceId);
      } else {
        // Fall back to voice name for narrator or when voice ID not available
        console.log('[Conversation] Using voice name fallback:', voiceName, '(voiceId was:', voiceId, ')');
        await this.ttsService.speakText(cleanedText, voiceName);
      }
      
      const duration = performance.now() - startTime;
      console.log(`[Conversation] ⏱️ TTS completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to speak text:', error);
      throw error;
    }
  }

  async processUserInput(userInput: string, config: ConversationConfig, autoSpeak: boolean = true): Promise<ConversationMessage> {
    // Validate input
    if (!userInput || userInput.trim() === '') {
      throw new Error('Empty user input received. Please speak clearly and try again.');
    }

    // Add user message to history
    this.addMessage('user', userInput);

    // Generate AI response
    const responseText = await this.generateResponse(config, userInput);
    
    // Add AI response to history
    const aiMessage = this.addMessage('companion', responseText);

    // Optionally start speaking the response 
    if (autoSpeak) {
      this.speakText(responseText, config.voiceName, config.voiceId).catch(error => {
        console.error('TTS playback failed:', error);
      });
    }

    return aiMessage;
  }

  async handleVoiceInput(config: ConversationConfig): Promise<{ userMessage: ConversationMessage; aiMessage: ConversationMessage }> {
    // Get speech input
    const userInput = await this.startListening();
    
    if (!userInput || userInput.trim() === '') {
      throw new Error('No speech detected');
    }

    // Add user message
    const userMessage = this.addMessage('user', userInput);

    // Process and respond
    const aiMessage = await this.processUserInput(userInput, config);

    return { userMessage, aiMessage };
  }
}