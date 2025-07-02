/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ElevenLabsVoice } from './data/elevenLabsVoices';
import elevenLabsVoicesData from './data/elevenLabsVoices.json';

export interface CharacterTraits {
  characterType: string;
  role: string;
  mood: string;
  style: string;
  coreTrait: string;
  mainWant: string;
  keyFlaw: string;
  gender?: 'male' | 'female' | 'neutral';
  age?: 'young' | 'middle_aged' | 'old';
  accent?: string;
}

export class VoiceSelectionService {
  private voices: ElevenLabsVoice[];

  constructor() {
    // Access the voices array from the imported JSON
    this.voices = elevenLabsVoicesData.voices as ElevenLabsVoice[];
    console.log('[VoiceSelection] Loaded', this.voices.length, 'voices from JSON');
  }

  /**
   * Selects the most appropriate voice ID based on character traits
   */
  selectVoiceForCharacter(traits: CharacterTraits): string {
    const startTime = performance.now();
    
    // Score each voice based on how well it matches the character traits
    const voiceScores = this.voices.map(voice => {
      const score = this.calculateVoiceScore(voice, traits);
      return { voice, score };
    });

    // Sort by score (highest first) and return the best match
    voiceScores.sort((a, b) => b.score - a.score);
    
    const selectedVoice = voiceScores[0];
    const duration = performance.now() - startTime;
    
    console.log(`[VoiceSelection] ⏱️ Selected voice ${selectedVoice.voice.name} (ID: ${selectedVoice.voice.id}) in ${duration.toFixed(2)}ms`);
    
    if (!selectedVoice.voice.id) {
      console.error('[VoiceSelection] ERROR: No voice ID found in selected voice!');
      console.error('[VoiceSelection] Voice object keys:', Object.keys(selectedVoice.voice));
    }
    
    return selectedVoice.voice.id;
  }

  /**
   * Calculates a score for how well a voice matches character traits
   */
  private calculateVoiceScore(voice: ElevenLabsVoice, traits: CharacterTraits): number {
    let score = 0;
    const debugScores: Record<string, number> = {};

    // Gender matching (high priority)
    if (traits.gender && voice.gender === traits.gender) {
      debugScores.gender = 30;
      score += 30;
    } else if (traits.gender === 'neutral' && voice.gender === 'female') {
      // Neutral characters can work well with female voices
      debugScores.gender = 15;
      score += 15;
    } else if (traits.gender === 'neutral' && voice.gender === 'male') {
      // Neutral characters can work with male voices too
      debugScores.gender = 10;
      score += 10;
    } else {
      debugScores.gender = 0;
    }

    // Age matching (medium priority)
    if (traits.age && voice.age === traits.age) {
      debugScores.age = 20;
      score += 20;
    } else if (traits.age === 'middle_aged' && voice.age === 'young') {
      // Close age match
      debugScores.age = 10;
      score += 10;
    } else if (traits.age === 'middle_aged' && voice.age === 'old') {
      // Close age match
      debugScores.age = 8;
      score += 8;
    } else {
      debugScores.age = 0;
    }

    // Accent matching (medium priority)  
    if (traits.accent && traits.accent !== '' && voice.accent === traits.accent) {
      debugScores.accent = 15;
      score += 15;
    } else if (!traits.accent || traits.accent === '') {
      // No accent preference - slight bonus for american/neutral accents
      if (voice.accent === 'american' || voice.accent === '') {
        debugScores.accent = 5;
        score += 5;
      } else {
        debugScores.accent = 2;
        score += 2;
      }
    } else {
      debugScores.accent = 0;
    }

    // Use case matching (low priority)
    const useCaseScore = this.getUseCaseScore(voice.useCase, traits);
    debugScores.useCase = useCaseScore;
    score += useCaseScore;

    // Character type and role matching
    const characterTypeScore = this.getCharacterTypeScore(voice, traits);
    debugScores.characterType = characterTypeScore;
    score += characterTypeScore;

    // Mood and style matching
    const moodStyleScore = this.getMoodStyleScore(voice, traits);
    debugScores.moodStyle = moodStyleScore;
    score += moodStyleScore;

    // Trait-based matching
    const traitScore = this.getTraitScore(voice, traits);
    debugScores.traits = traitScore;
    score += traitScore;

    // Remove verbose debug logging for performance

    return score;
  }

  private getUseCaseScore(useCase: string, traits: CharacterTraits): number {
    let score = 0;
    
    // Base score for character-appropriate use cases
    if (useCase === 'characters' || useCase === 'characters_animation') {
      score += 15; // Higher base score for character voices
    } else if (useCase === 'conversational') {
      score += 10; // Good for talking characters
    } else if (useCase === 'entertainment_tv') {
      score += 8;
    }

    const useCaseMap: Record<string, string[]> = {
      'characters': ['character', 'companion', 'hero', 'villain', 'protagonist', 'detective', 'investigator'],
      'characters_animation': ['animated', 'cartoon', 'sprite', 'fantasy', 'magical', 'creature'],
      'conversational': ['friendly', 'talkative', 'social', 'chatty', 'companion'],
      'narrative_story': ['storyteller', 'narrator', 'bard', 'chronicler'],
      'entertainment_tv': ['entertainer', 'performer', 'actor'],
      'social_media': ['influencer', 'content creator', 'streamer']
    };

    const keywords = useCaseMap[useCase] || [];
    const combinedTraits = `${traits.role} ${traits.characterType} ${traits.style}`.toLowerCase();
    
    const keywordScore = keywords.reduce((acc, keyword) => {
      return combinedTraits.includes(keyword) ? acc + 8 : acc; // Increased from 5 to 8
    }, 0);
    
    return score + keywordScore;
  }

  private getCharacterTypeScore(voice: ElevenLabsVoice, traits: CharacterTraits): number {
    let score = 0;
    const description = voice.description.toLowerCase();
    const characterType = traits.characterType.toLowerCase();
    const role = traits.role.toLowerCase();

    // Broader character matching for quirky/unique characters
    if (characterType.includes('dust') || characterType.includes('creature') || characterType.includes('sprite')) {
      if (description.includes('playful') || description.includes('quirky') || description.includes('bright')) {
        score += 12;
      }
      if (voice.useCase === 'characters_animation') {
        score += 10;
      }
    }

    // Detective/investigator characters
    if (role.includes('detective') || role.includes('investigator') || role.includes('sleuth')) {
      if (description.includes('clear') || description.includes('confident') || description.includes('mature')) {
        score += 12;
      }
    }

    // Match character archetypes
    if (characterType.includes('noble') || role.includes('royal') || role.includes('lord')) {
      if (description.includes('professional') || description.includes('mature') || voice.accent === 'british') {
        score += 10;
      }
    }

    if (characterType.includes('warrior') || role.includes('guard') || role.includes('soldier')) {
      if (description.includes('strong') || description.includes('confident') || voice.gender === 'male') {
        score += 8;
      }
    }

    if (characterType.includes('mystic') || role.includes('mage') || role.includes('wizard')) {
      if (description.includes('mysterious') || description.includes('wise') || voice.age === 'middle_aged') {
        score += 8;
      }
    }

    if (characterType.includes('rogue') || role.includes('thief') || role.includes('spy')) {
      if (description.includes('smooth') || description.includes('sly') || description.includes('raspy')) {
        score += 8;
      }
    }

    return score;
  }

  private getMoodStyleScore(voice: ElevenLabsVoice, traits: CharacterTraits): number {
    let score = 0;
    const description = voice.description.toLowerCase();
    const mood = traits.mood.toLowerCase();
    const style = traits.style.toLowerCase();

    // Mood matching
    if (mood.includes('confident') && description.includes('confident')) score += 8;
    if (mood.includes('warm') && description.includes('warm')) score += 8;
    if (mood.includes('energetic') && description.includes('energetic')) score += 8;
    if (mood.includes('calm') && description.includes('calm')) score += 8;
    if (mood.includes('mysterious') && description.includes('mysterious')) score += 8;
    if (mood.includes('playful') && description.includes('playful')) score += 8;

    // Style matching
    if (style.includes('formal') && (description.includes('professional') || voice.accent === 'british')) score += 6;
    if (style.includes('casual') && description.includes('casual')) score += 6;
    if (style.includes('gruff') && description.includes('gravelly')) score += 6;
    if (style.includes('smooth') && description.includes('smooth')) score += 6;

    return score;
  }

  private getTraitScore(voice: ElevenLabsVoice, traits: CharacterTraits): number {
    let score = 0;
    const description = voice.description.toLowerCase();
    const coreTrait = traits.coreTrait.toLowerCase();
    const mainWant = traits.mainWant.toLowerCase();
    const keyFlaw = traits.keyFlaw.toLowerCase();

    // Core trait matching
    if (coreTrait.includes('confident') && description.includes('confident')) score += 5;
    if (coreTrait.includes('mysterious') && description.includes('mysterious')) score += 5;
    if (coreTrait.includes('friendly') && description.includes('friendly')) score += 5;
    if (coreTrait.includes('wise') && description.includes('mature')) score += 5;
    if (coreTrait.includes('energetic') && description.includes('energetic')) score += 5;

    // Personality flaw considerations
    if (keyFlaw.includes('shy') && description.includes('soft')) score += 3;
    if (keyFlaw.includes('arrogant') && description.includes('confident')) score += 3;
    if (keyFlaw.includes('gruff') && description.includes('gravelly')) score += 3;

    return score;
  }

  /**
   * Selects an appropriate narrator voice based on genre and scene type
   */
  selectNarratorVoice(genre: string, sceneType: 'opening' | 'transition' | 'dramatic' = 'opening'): string {
    console.log('[VoiceSelection] Selecting narrator voice for genre:', genre, 'sceneType:', sceneType);

    // Define narrator voice preferences by genre - USECASE is primary criteria
    const genreUseCaseMap: Record<string, { primary: string[], secondary: string[] }> = {
      'Comedy': {
        primary: ['entertainment_tv', 'social_media'],
        secondary: ['conversational', 'characters']
      },
      'Fantasy': {
        primary: ['narrative_story', 'informative_educational'],
        secondary: ['entertainment_tv', 'conversational']
      },
      'Sci-Fi': {
        primary: ['informative_educational', 'narrative_story'],
        secondary: ['entertainment_tv', 'conversational']
      },
      'Horror': {
        primary: ['narrative_story', 'characters'],
        secondary: ['informative_educational', 'entertainment_tv']
      },
      'Mystery': {
        primary: ['informative_educational', 'narrative_story'],
        secondary: ['conversational', 'characters']
      },
      'Noir': {
        primary: ['narrative_story', 'characters'],
        secondary: ['informative_educational', 'entertainment_tv']
      },
      'Thriller': {
        primary: ['informative_educational', 'narrative_story'],
        secondary: ['entertainment_tv', 'characters']
      },
      'Adventure': {
        primary: ['entertainment_tv', 'narrative_story'],
        secondary: ['conversational', 'informative_educational']
      },
      'Western': {
        primary: ['narrative_story', 'characters'],
        secondary: ['entertainment_tv', 'informative_educational']
      },
      'Fairy Tale': {
        primary: ['narrative_story', 'entertainment_tv'],
        secondary: ['conversational', 'informative_educational']
      }
    };

    const useCasePrefs = genreUseCaseMap[genre] || genreUseCaseMap['Adventure'];
    
    // Score ALL voices, but heavily weight by use case match
    const scoredVoices = this.voices.map(voice => ({
      voice,
      score: this.calculateNarratorScore(voice, genre, sceneType, useCasePrefs)
    }));

    scoredVoices.sort((a, b) => b.score - a.score);

    const selectedVoice = scoredVoices[0];
    console.log('[VoiceSelection] Top 5 narrator voices for', genre + ':', scoredVoices.slice(0, 5).map(v => ({
      name: v.voice.name,
      score: v.score,
      useCase: v.voice.useCase,
      description: v.voice.description.substring(0, 50) + '...',
      age: v.voice.age,
      gender: v.voice.gender
    })));
    console.log('[VoiceSelection] Selected narrator voice:', selectedVoice.voice.name, 'ID:', selectedVoice.voice.id, 'Score:', selectedVoice.score);
    
    return selectedVoice.voice.id;
  }

  /**
   * Calculates narrator voice suitability score
   */
  private calculateNarratorScore(voice: ElevenLabsVoice, genre: string, sceneType: string, useCasePrefs: { primary: string[], secondary: string[] }): number {
    let score = 0;
    const description = voice.description.toLowerCase();

    // PRIMARY: Use case matching - this is now the most important factor
    if (useCasePrefs.primary.includes(voice.useCase)) {
      score += 40; // Major bonus for perfect use case match
    } else if (useCasePrefs.secondary.includes(voice.useCase)) {
      score += 20; // Good bonus for secondary use case match
    } else {
      score += 5; // Small base score for other use cases
    }

    // SECONDARY: Age preferences by genre
    if (genre === 'Comedy') {
      if (voice.age === 'young') score += 12;
      if (voice.age === 'middle_aged') score += 6;
    } else if (genre === 'Horror' || genre === 'Noir') {
      if (voice.age === 'middle_aged' || voice.age === 'old') score += 8;
    } else {
      // Most genres prefer mature narrators
      if (voice.age === 'middle_aged') score += 8;
      if (voice.age === 'old') score += 5;
    }
    
    // TERTIARY: Description-based personality matching
    if (genre === 'Comedy') {
      if (description.includes('energetic') || description.includes('lively')) score += 15;
      if (description.includes('playful') || description.includes('bright')) score += 12;
      if (description.includes('youthful') || description.includes('upbeat')) score += 10;
      if (description.includes('confident')) score += 8;
      
      // Penalize overly serious voices for comedy
      if (description.includes('professional') || description.includes('authoritative')) score -= 8;
      if (description.includes('mature') && !description.includes('energetic')) score -= 5;
    } else if (genre === 'Horror') {
      if (description.includes('gravelly') || description.includes('deep')) score += 12;
      if (description.includes('mysterious') || description.includes('dark')) score += 10;
    } else if (genre === 'Fantasy') {
      if (description.includes('warm') || description.includes('rich')) score += 10;
      if (voice.accent === 'british') score += 12;
    } else if (genre === 'Sci-Fi' || genre === 'Thriller') {
      if (description.includes('professional') || description.includes('clear')) score += 10;
      if (description.includes('confident') || description.includes('authoritative')) score += 8;
    } else {
      // Default narrator qualities for other genres
      if (description.includes('clear') || description.includes('professional')) score += 8;
      if (description.includes('warm') || description.includes('engaging')) score += 6;
    }

    // MINOR: Accent bonuses for specific genres
    if (genre === 'Fantasy' && voice.accent === 'british') score += 8;
    if (genre === 'Western' && voice.accent === 'american') score += 6;
    if (genre === 'Comedy' && voice.accent === 'american') score += 4;

    return score;
  }

  /**
   * Gets available voice options for character generation prompt
   */
  getAvailableVoiceIds(): string[] {
    return this.voices.map(voice => voice.id);
  }

  /**
   * Gets voice details by ID
   */
  getVoiceById(id: string): ElevenLabsVoice | undefined {
    return this.voices.find(voice => voice.id === id);
  }

  /**
   * Gets available voices filtered by criteria
   */
  getVoicesByFilter(filter: Partial<ElevenLabsVoice>): ElevenLabsVoice[] {
    return this.voices.filter(voice => {
      return Object.entries(filter).every(([key, value]) => {
        return voice[key as keyof ElevenLabsVoice] === value;
      });
    });
  }
}

export const voiceSelectionService = new VoiceSelectionService();