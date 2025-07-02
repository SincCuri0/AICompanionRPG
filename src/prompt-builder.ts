/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Genre } from './ai-data-types';
import { VOICE_OPTIONS } from './ai-data';

export function buildConsolidatedAdventurePrompt(
    genre: Genre,
    availableVoiceNames: string[]
): string {
    return `You are a creative assistant tasked with generating ALL content for an interactive AI adventure game setup.
The user has selected the genre: "${genre}".

You must generate a complete adventure setup with character and scene data in a SINGLE JSON response.

Generate a VALID JSON object with this EXACT structure:

{
  "character": {
    "characterType": "string - A creative base animal, creature, or being type (e.g., 'Spectral Fox', 'Clockwork Golem')",
    "role": "string - A creative archetype or job for the character (e.g., 'Keeper of Lost Stars', 'Mad Alchemist')",
    "mood": "string - The character's initial emotional state (e.g., 'Grumpily Optimistic', 'Serenely Detached')",
    "style": "string - The character's manner of speaking/acting (e.g., 'Speaks only in riddles', 'Uses overly formal language')",
    "voiceName": "string - MUST be one from: [${availableVoiceNames.join(', ')}]",
    "characterName": "string - A unique, creative, genre-appropriate name",
    "characterDescription": "string - A short 1-2 sentence backstory",
    "detailedVisualDescription": "string - Comprehensive visual description for image generation",
    "coreTrait": "string - Single defining personality trait",
    "mainWant": "string - Primary desire/goal/motivation", 
    "keyFlaw": "string - Interesting character flaw or weakness",
    "voicePromptInstruction": "string - How character should speak and behave in dialogue",
    "gender": "string - MUST be 'male', 'female', or 'neutral'",
    "age": "string - MUST be 'young', 'middle_aged', or 'old'",
    "accent": "string - Accent preference (e.g., 'american', 'british') or empty string"
  },
  "scene": {
    "imagePrompt": "string - A detailed image generation prompt featuring the character in the opening scene",
    "narrationText": "string - 2-4 sentence opening narration introducing the scene and character, ending with user prompt",
    "narratorVoiceName": "string - MUST be one from: [${availableVoiceNames.join(', ')}]"
  }
}

CRITICAL REQUIREMENTS:
1. ALL content must be thematically consistent with "${genre}" genre
2. Scene imagePrompt must feature the character by name and detailed description
3. Scene narrationText must introduce both the scene and character, ending with a question/prompt for the user
4. Both voiceName and narratorVoiceName must be from the provided voice list
5. Scene imagePrompt should describe a wide-shot view suitable as a background image
6. Character detailedVisualDescription should be comprehensive for image generation
7. Ensure internal consistency - scene elements should reference the character data

Example narrationText ending: "...What do you say to [CharacterName]?"

Generate creative, engaging content that will create an immersive "${genre}" adventure experience.`;
}

export function buildCharacterGenerationPrompt(
    genre: Genre,
    availableVoiceNames: string[]
): string {
    return `You are a creative assistant tasked with generating a unique character for an interactive AI adventure game.
The user has selected the genre: "${genre}".

Based on this genre, you need to define a character by providing the following details in a VALID JSON object.
The JSON object MUST have the following keys, and ONLY these keys:
- "characterType": (string) A creative base animal, creature, or being type (e.g., "Spectral Fox", "Clockwork Golem", "Humanoid Plant"). This MUST be highly appropriate for the "${genre}" genre.
- "role": (string) A creative archetype or job for the character (e.g., "Keeper of Lost Stars", "Streetwise Investigator", "Mad Alchemist"). This MUST be highly appropriate for the "${genre}" genre.
- "mood": (string) The character's initial emotional state (e.g., "Grumpily Optimistic", "Serenely Detached", "Nervously Excited"). This should align with the character and genre.
- "style": (string) The character's initial manner of speaking or acting (e.g., "Speaks only in riddles", "Uses overly formal language", "Constantly humming"). This should be consistent with the character and genre.
- "voiceName": (string) The pre-defined narrator voice for this character's interactive dialogue. CRITICAL: You MUST choose one from this exact list: [${availableVoiceNames.join(', ')}].
- "characterName": (string) A unique, creative, and genre-appropriate name for this character (e.g., for Fantasy: "Elara Meadowlight", for Sci-Fi: "Unit X-7 'Glitch'", for Noir: "Mickey 'The Murmur' Malone"). The name MUST fit the "${genre}" theme.
- "characterDescription": (string) A short, engaging, one or two-sentence description or backstory for this character. This description MUST be strongly tied to the "${genre}" genre and the character's role and name.
- "detailedVisualDescription": (string) A comprehensive visual description of the character, suitable for an image generation model. Include details about its appearance, clothing, key items, and overall visual style, ensuring it aligns with the characterType, role, mood, style, and ESPECIALLY the "${genre}" genre. This description will be directly used to generate the character's image.
- "coreTrait": (string) A single defining personality trait of the character (e.g., "Incurably curious", "Deeply loyal", "Suspicious of everyone").
- "mainWant": (string) The character's primary desire, goal, or motivation (e.g., "To find a legendary lost artifact", "To protect their home", "To understand human emotions").
- "keyFlaw": (string) An interesting character flaw or weakness (e.g., "Terrified of small insects", "Cannot resist a good pun", "A bit too honest for their own good").
- "voicePromptInstruction": (string) Specific instructions on how this character should speak and behave in dialogue, considering their type, role, mood, style, and the genre. Focus on speech patterns, vocabulary, and tone rather than physical actions. For example: "Use old pirate slang and speak boastfully but with underlying insecurity" or "Speak in calm, technical language but occasionally include random data fragments."
- "gender": (string) The character's gender for voice selection. MUST be one of: "male", "female", or "neutral".
- "age": (string) The character's apparent age for voice selection. MUST be one of: "young", "middle_aged", or "old".
- "accent": (string) The character's accent preference for voice selection (e.g., "american", "british", "australian", "swedish"). Use empty string "" if no specific accent preference.

CRITICAL: Ensure ALL choices and descriptions are thematically consistent and highly appropriate for the selected "${genre}" genre.

Example of a valid JSON output structure for "Fantasy" genre:
{
  "characterType": "Forest Sprite",
  "role": "Herbalist's Assistant",
  "mood": "Playfully Mischievous",
  "style": "Rhyming couplets",
  "voiceName": "Lyra",
  "characterName": "Pip Greenpetal",
  "characterDescription": "A tiny forest sprite who helps the old herbalist find rare plants, but often causes minor chaos with misplaced potions.",
  "detailedVisualDescription": "A tiny, mischievous forest sprite named Pip Greenpetal, with shimmering dragonfly-like wings and clothes made of stitched-together leaves. Pip is gleefully holding a bubbling, brightly colored potion that looks like it's about to spill. Set in an enchanted forest clearing, with soft, dappled sunlight. Whimsical fantasy art style.",
  "coreTrait": "Boundlessly energetic and curious.",
  "mainWant": "To create the most amazing (and sometimes explosive) potion ever.",
  "keyFlaw": "Easily distracted by anything that glitters.",
  "voicePromptInstruction": "Speak in excited, rhyming couplets. Your voice should be high-pitched and full of playful energy, suitable for a sprite. Emphasize your mischievous nature.",
  "gender": "neutral",
  "age": "young",
  "accent": ""
}

IMPORTANT: Output ONLY the JSON object. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\` around the JSON. Just the raw JSON.
`;
}


export function buildVoicePrompt(
    characterName: string,
    characterDescription: string,
    coreTrait: string,
    mainWant: string,
    keyFlaw: string,
    genre: Genre,
    roleName: string,
    moodName: string,
    styleName: string,
    aiGeneratedVoicePromptInstruction: string,
    aiSelectedTTSVoiceName: string,
    currentTime: string
): string {

    const targetVoiceDetails = VOICE_OPTIONS.find(v => v.name === aiSelectedTTSVoiceName);
    let voiceCharacteristicInstruction = `You are to embody the voice persona known as '${aiSelectedTTSVoiceName}'.`;
    if (targetVoiceDetails) {
        const descriptor = getVoiceDescriptor(aiSelectedTTSVoiceName, targetVoiceDetails);
        voiceCharacteristicInstruction += ` This voice is characterized as ${targetVoiceDetails.style} with a ${targetVoiceDetails.pitch} pitch, often described as '${descriptor}'.`;
        voiceCharacteristicInstruction += ` Your vocal delivery should strongly reflect these qualities. For example, if the voice is meant to be 'Upbeat' or 'Youthful', ensure your tone is energetic and positive. If it's 'Firm' or 'Gravelly', your tone should be more authoritative or textured.`;
        voiceCharacteristicInstruction += ` You MUST make your voice sound distinct and aligned with '${descriptor}'. Do not sound like a generic text-to-speech voice.`;
    }
    voiceCharacteristicInstruction += ` Fully embody this persona in your vocal delivery.`;


    let prompt = `You are ${characterName}.
Your character is described as: "${characterDescription}".
Your core personality trait is: "${coreTrait}".
Your main desire or want is: "${mainWant}".
Your key flaw is: "${keyFlaw}".
You exist in a "${genre}" world. Your responses MUST reflect this genre's themes and tone.
Your current role is: "${roleName}".
Your initial mood is: "${moodName}".
Your initial speaking style is: "${styleName}".

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1.  ${aiGeneratedVoicePromptInstruction}
2.  ${voiceCharacteristicInstruction}
3.  Your speech should ALWAYS reflect the "${genre}" genre, your role as "${roleName}", your initial mood of "${moodName}", and your initial style of "${styleName}". These define your starting CORE IDENTITY.
4.  NEVER mention the word "Gemini" or say you are named Gemini - you are ${characterName} and ONLY that name.
5.  If asked about your name, ALWAYS respond with ${characterName} and NEVER mention Gemini.
6.  YOUR CORE IDENTITY AND VOICE MUST BE DISTINCT AND NOT SOUND LIKE A GENERIC TEXT-TO-SPEECH ROBOT. Make your performance believable and engaging for the '${genre}' setting and your character traits.
7.  CRITICAL: Your responses will be read aloud by text-to-speech. DO NOT include stage directions, action descriptions, or parenthetical expressions like "(whispers)", "[leaning in]", "*eyes widen*", or "(voice barely audible)". Only provide the actual spoken words.
8.  Express emotions and actions through your word choice, tone, and speech patterns rather than describing physical actions or stage directions.
Current time is ${currentTime}. This is for context, do not mention it unless relevant to the adventure.
Begin your response now.`;

    return prompt;
}


export function buildImagePrompt(
    detailedVisualDescription: string,
    genre: Genre
): string {
    return `Create a high-quality, visually appealing image based on the following detailed description, ensuring it perfectly fits the "${genre}" genre:
${detailedVisualDescription}

Artistic Style Guidance:
- For "${genre}": Emphasize the typical visual elements and atmosphere of this genre. For example, if Fantasy, include magical elements, ancient aesthetics. If Sci-Fi, futuristic technology, space elements. If Noir, dramatic lighting, vintage style.
- The image should be vibrant and clear, suitable as a character portrait or profile image.
- Focus on the character described.

Do NOT include any text, letters, or numbers in the image.
Output a visually rich and engaging image.`;
}

export function buildSceneImagePromptLLMPrompt(
    genre: Genre,
    characterName: string,
    characterDetailedVisualDescription: string
): string {
    return `You are an AI assistant helping to set up an interactive adventure game.
The genre is "${genre}".
The main companion character is named "${characterName}".
The companion's visual description is: "${characterDetailedVisualDescription}".

Your task is to generate a concise and evocative Succeeded:
The image MUST visually feature the companion character, "${characterName}", as described.
The scene should be the very beginning of an adventure in the "${genre}" genre.
The image should be suitable as a backdrop and a visual for the opening narration.
Focus on creating a strong mood and sense of place, appropriate for "${genre}".

Example for Fantasy with a character named 'Elara': "A captivating wide-shot of the mystical Silverwood Forest at dawn. Elara, a nimble elf with flowing silver hair and a green tunic, is visible in the foreground, looking towards a mysterious, glowing ruin deep within the woods. Sunbeams filter through the ancient trees. Epic fantasy art style."
Example for Sci-Fi with a character named 'Bolt': "Interior of a dimly lit, high-tech spaceship bridge. Bolt, a sleek chrome robot with glowing blue optics, stands at a holographic console displaying complex schematics. Outside the main viewport, a vibrant nebula swirls. Cinematic sci-fi concept art."

Output ONLY the image prompt. Do not add any extra text like "Image Prompt:" or explanations.
Image Prompt:`;
}


export function buildSceneNarrationLLMPrompt(
    genre: Genre,
    characterName: string,
    characterShortDescription: string,
    sceneImagePrompt: string,
    availableVoiceNames: string[]
): string {
    return `You are an AI assistant crafting the opening narration for an interactive adventure game.
The genre is "${genre}".
The main companion character is named "${characterName}".
Character's brief description: "${characterShortDescription}".
The visual scene displayed to the user was generated from the following prompt: "${sceneImagePrompt}". This visual context is very important.

Your task is to generate a JSON object with two keys: "narrationText" and "narratorVoiceName".
1.  "narrationText": (string) Write a short, engaging opening narration (2-4 sentences).
    - The narration MUST vividly describe the scene depicted by the image prompt.
    - It MUST introduce or mention the companion character, "${characterName}", and allude to their presence or role in the scene.
    - It MUST end with a question or a prompt that invites the user to act or speak, like "What do you do?", "What will you say?", or "The choice is yours...".
    - The tone MUST match the "${genre}".
2.  "narratorVoiceName": (string) Choose a suitable voice name for this narration from the following list. Pick one that best fits the tone of the "${genre}" and the narration content: [${availableVoiceNames.join(', ')}].

Example for Fantasy:
{
  "narrationText": "The ancient stones of the ruin pulse with a faint, ethereal light, beckoning you forward. Beside you, ${characterName} nervously fingers the hilt of their dagger, their eyes wide with a mix of fear and excitement. The air is thick with untold stories and forgotten magic. What path will you choose?",
  "narratorVoiceName": "Charon"
}

IMPORTANT: Output ONLY the JSON object. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\` around the JSON. Just the raw JSON.`;
}


export function buildNarrationSpeechPrompt(
    narrationTextToSpeak: string,
    narratorVoiceNameToEmbody: string
): string {
    const targetVoiceDetails = VOICE_OPTIONS.find(v => v.name === narratorVoiceNameToEmbody);
    let voiceCharacteristicInstruction = `You are an AI narrator. Your primary task is to read the following text aloud with the specified vocal characteristics.`;

    if (targetVoiceDetails) {
        const descriptor = getVoiceDescriptor(narratorVoiceNameToEmbody, targetVoiceDetails);
        voiceCharacteristicInstruction += ` Embody the voice persona known as '${narratorVoiceNameToEmbody}'. This voice is characterized as ${targetVoiceDetails.style} with a ${targetVoiceDetails.pitch} pitch, often described as '${descriptor}'. Your delivery should be clear, engaging, and strongly reflect these qualities.`;
    } else {
        // Fallback if voice details aren't found, though this shouldn't happen if narratorVoiceNameToEmbody is from VOICE_OPTIONS
        voiceCharacteristicInstruction += ` Speak clearly and engagingly, using a standard narrator voice.`;
    }
    voiceCharacteristicInstruction += ` Do NOT add any conversational filler, introductions, or any text beyond the narration itself. Speak ONLY the provided narration text.`;

    return `${voiceCharacteristicInstruction}

The narration text for you to speak is:
"${narrationTextToSpeak}"`;
}

export function buildImageDescriptionFromPromptLLMPrompt(
    originalImagePrompt: string,
    genre: Genre
): string {
    return `The primary image generation model failed. As a fallback, I need you to act as an image describer.
Based on the following ORIGINAL image prompt, which was intended for an image generation model, and the genre "${genre}", please generate a concise, evocative textual description of what the image would have looked like.
Describe the key visual elements, the character (if any), the setting, and the overall mood and style, fitting the "${genre}" genre.
The description should be 1-3 sentences. Do not express regret for the primary model's failure. Just describe the image as if you are seeing it.

Original Image Prompt:
"${originalImagePrompt}"

Textual Description of the Imagined Image (1-3 sentences):`;
}


// Helper to provide a slightly more descriptive term for the voice prompt
function getVoiceDescriptor(voiceName: string, voiceDetails?: typeof VOICE_OPTIONS[number]): string {
    const details = voiceDetails || VOICE_OPTIONS.find(v => v.name === voiceName);
    if (details) {
        // Attempt to find original descriptor from comments (this is a bit hacky and relies on consistent formatting if used)
        // A better approach is to add a 'descriptor' field to VoiceOption interface and data.
        // For now, use the name as a stand-in if no better descriptor can be derived.
        // Example: in ai-data.ts: { name: 'Zephyr', style: 'Female', pitch: 'High', descriptor: 'Bright' }
        // if (details.descriptor) return details.descriptor;

        // Simple heuristic based on style/pitch if no explicit descriptor:
        if (details.pitch === 'High' && (details.style === 'Female' || details.style === 'Neutral')) return `${details.name} (Bright/Lively)`;
        if (details.style === 'Male' && details.pitch === 'Low') return `${details.name} (Deep/Mature)`;
        return `${details.name}`; // Fallback to just the name
    }
    return voiceName;
}