/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class TextCleanupService {
  /**
   * Cleans text for TTS by removing stage directions, action descriptions, and other non-speech content
   */
  static cleanForTTS(text: string): string {
    let cleaned = text;

    // Remove parenthetical stage directions like "(Leaning in, eyes wide...)"
    cleaned = cleaned.replace(/\([^)]*\)/g, '');

    // Remove square bracket descriptions like "[whispers]" or "[shouting]"
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

    // Remove asterisk actions like "*whispers*" or "*leans closer*"
    cleaned = cleaned.replace(/\*[^*]*\*/g, '');

    // Remove common stage direction patterns
    cleaned = cleaned.replace(/\b(whispers?|shouts?|yells?|mutters?|sighs?)\s*[:;]/gi, '');

    // Remove action descriptions in various formats
    cleaned = cleaned.replace(/\b(voice barely audible|in a whisper|shouting|yelling|muttering)\b/gi, '');

    // Remove emotional descriptions that don't belong in speech
    cleaned = cleaned.replace(/\b(eyes wide|leaning in|with a glint|conspiratorial|barely audible)\b/gi, '');

    // Remove extra whitespace and normalize
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove leading/trailing punctuation that might be left over
    cleaned = cleaned.replace(/^[,;:\s]+|[,;:\s]+$/g, '');

    console.log('[TextCleanup] Original:', text.substring(0, 100) + '...');
    console.log('[TextCleanup] Cleaned:', cleaned.substring(0, 100) + '...');

    return cleaned;
  }

  /**
   * Extracts the speaking style/emotion from stage directions for potential voice modulation
   * This could be used later for voice parameter adjustments if ElevenLabs adds such features
   */
  static extractSpeakingStyle(text: string): {
    style: string[];
    emotion: string[];
    volume: string[];
  } {
    const styles: string[] = [];
    const emotions: string[] = [];
    const volumes: string[] = [];

    // Extract volume/intensity indicators
    if (/whisper|barely audible|quiet/i.test(text)) volumes.push('quiet');
    if (/shout|yell|loud/i.test(text)) volumes.push('loud');
    if (/mutter|mumble/i.test(text)) volumes.push('mumbled');

    // Extract emotional states
    if (/conspiratorial|secretive/i.test(text)) emotions.push('secretive');
    if (/excited|energetic/i.test(text)) emotions.push('excited');
    if (/nervous|anxious/i.test(text)) emotions.push('nervous');
    if (/confident|assured/i.test(text)) emotions.push('confident');

    // Extract speaking styles
    if (/formal|professional/i.test(text)) styles.push('formal');
    if (/casual|relaxed/i.test(text)) styles.push('casual');
    if (/dramatic|theatrical/i.test(text)) styles.push('dramatic');

    return { style: styles, emotion: emotions, volume: volumes };
  }

  /**
   * Checks if text contains stage directions that should be cleaned
   */
  static hasStageDirections(text: string): boolean {
    const patterns = [
      /\([^)]*\)/, // Parentheses
      /\[[^\]]*\]/, // Square brackets
      /\*[^*]*\*/, // Asterisks
      /\b(whispers?|shouts?|yells?|mutters?)\s*[:;]/i, // Voice directions
      /\b(eyes wide|leaning in|with a glint|barely audible)\b/i // Action descriptions
    ];

    return patterns.some(pattern => pattern.test(text));
  }
}