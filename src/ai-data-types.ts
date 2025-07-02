/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
export interface CharacterAttribute {
  name: string;
  emoji: string;
  trait: string;
  want: string;
  flaw: string;
  nameIntro: string;
  visualDescriptor: string;
}

export type CharacterAttributes = Record<string, CharacterAttribute>;

export interface MoodAttribute {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}
export type MoodAttributes = Record<string, MoodAttribute>;

export interface RoleAttribute {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}
export type RoleAttributes = Record<string, RoleAttribute>;

export interface StyleAttribute {
  emoji: string;
  visualDescriptor: string;
}
export type StyleAttributes = Record<string, StyleAttribute>;

export type VisualAccessories = Record<string, string[]>;

export interface VoiceOption {
    name: string;
    style: string; // e.g., 'Male', 'Female', 'Child', 'Robot'
    pitch: string; // e.g., 'Normal', 'High', 'Low'
    // Additional properties like language might be useful if expanding
    // For browser SpeechSynthesis, we'll map these to available system voices.
}
export type VoiceOptions = VoiceOption[];

export const GENRES_LIST = [
    'Fantasy', 
    'Sci-Fi', 
    'Mystery', 
    'Horror', 
    'Comedy', 
    'Adventure', 
    'Noir', 
    'Western', 
    'Fairy Tale',
    'Magical Realism', // Added
    'Cosmic Horror',  // Added
    'Thriller'        // Added
] as const;
export type Genre = typeof GENRES_LIST[number];