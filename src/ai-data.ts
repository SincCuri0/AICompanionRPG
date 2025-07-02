/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    VoiceOptions,
    GENRES_LIST // Import the const array
} from './ai-data-types';

// Export GENRES_LIST under the name GENRES for use in the application
export const GENRES = GENRES_LIST;

// CHARACTER_ATTRIBUTES, MOOD_ATTRIBUTES, ROLE_ATTRIBUTES, STYLE_ATTRIBUTES, VISUAL_ACCESSORIES
// are no longer needed here as the AI generates these details dynamically based on prompts.
// Keeping them in ai-data-types.ts might be useful for type reference if we ever
// want to structure the AI's output more formally, but the app no longer relies on these fixed maps.

// These voice names MUST be valid Google Cloud Text-to-Speech voice names
// supported by the 'gemini-2.5-flash-preview-native-audio-dialog' model.
// The 'style' and 'pitch' are for LLM guidance when selecting a voice,
// and for helping browser's SpeechSynthesis select a narrator voice.
export const VOICE_OPTIONS: VoiceOptions = [
    { name: 'Zephyr', style: 'Female', pitch: 'High' },          // Bright
    { name: 'Puck', style: 'Male', pitch: 'Normal' },            // Upbeat
    { name: 'Charon', style: 'Male', pitch: 'Normal' },          // Informative
    { name: 'Kore', style: 'Female', pitch: 'Normal' },          // Firm
    { name: 'Fenrir', style: 'Male', pitch: 'High' },            // Excitable
    { name: 'Leda', style: 'Female', pitch: 'High' },            // Youthful
    { name: 'Orus', style: 'Male', pitch: 'Normal' },            // Firm
    { name: 'Aoede', style: 'Female', pitch: 'Normal' },         // Breezy
    { name: 'Callirrhoe', style: 'Female', pitch: 'Normal' },    // Easy-going
    { name: 'Autonoe', style: 'Female', pitch: 'High' },         // Bright
    { name: 'Enceladus', style: 'Male', pitch: 'Low' },          // Breathy
    { name: 'Iapetus', style: 'Male', pitch: 'Normal' },         // Clear
    { name: 'Umbriel', style: 'Male', pitch: 'Normal' },         // Easy-going
    { name: 'Algieba', style: 'Female', pitch: 'Normal' },       // Smooth
    { name: 'Despina', style: 'Female', pitch: 'Normal' },       // Smooth
    { name: 'Erinome', style: 'Female', pitch: 'Normal' },       // Clear
    { name: 'Algenib', style: 'Male', pitch: 'Low' },            // Gravelly
    { name: 'Rasalgethi', style: 'Male', pitch: 'Normal' },      // Informative
    { name: 'Laomedeia', style: 'Female', pitch: 'Normal' },     // Upbeat
    { name: 'Achernar', style: 'Female', pitch: 'Low' },         // Soft
    { name: 'Alnilam', style: 'Male', pitch: 'Normal' },         // Firm
    { name: 'Schedar', style: 'Neutral', pitch: 'Normal' },      // Even
    { name: 'Gacrux', style: 'Male', pitch: 'Low' },             // Mature
    { name: 'Pulcherrima', style: 'Female', pitch: 'Normal' },   // Forward
    { name: 'Achird', style: 'Female', pitch: 'Normal' },        // Friendly
    { name: 'Zubenelgenubi', style: 'Male', pitch: 'Normal' },   // Casual
    { name: 'Vindemiatrix', style: 'Female', pitch: 'Normal' },  // Gentle
    { name: 'Sadachbia', style: 'Female', pitch: 'High' },       // Lively
    { name: 'Sadaltager', style: 'Male', pitch: 'Normal' },      // Knowledgeable
    { name: 'Sulafat', style: 'Female', pitch: 'Normal' }        // Warm
];
