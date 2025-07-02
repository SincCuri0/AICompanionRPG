/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { StartSensitivity } from '@google/genai';

export const DEFAULT_DIALOG_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog'; // Reverted for live.connect compatibility
export const DEFAULT_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
export const FALLBACK_IMAGE_GENERATION_MODEL = 'gemini-2.0-flash-preview-image-generation';
export const DEFAULT_INTERRUPT_SENSITIVITY = StartSensitivity.START_SENSITIVITY_HIGH;

export const AVAILABLE_DIALOG_MODELS = [
  { id: 'gemini-2.5-flash-preview-native-audio-dialog', label: '2.5 Flash Native Audio Dialog' }, // Reverted
  // { id: 'gemini-2.5-flash', label: '2.5 Flash Preview 04-17' } // General model, not for bidiGenerateContent
];
export const AVAILABLE_IMAGE_MODELS = [
  { id: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Image (Fallback)' }
];

export const INTERRUPT_SENSITIVITY_OPTIONS = [
  { value: StartSensitivity.START_SENSITIVITY_LOW, label: 'Harder to interrupt' },
  { value: StartSensitivity.START_SENSITIVITY_HIGH, label: 'Easier to interrupt' }
];

// Audio processing thresholds
export const QUIET_THRESHOLD = 0.2; // Adjust this value based on testing
export const QUIET_DURATION = 3000; // milliseconds, was 2000, increased for more tolerance
export const EXTENDED_QUIET_DURATION = 10000; // milliseconds