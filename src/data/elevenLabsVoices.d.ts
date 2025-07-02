// Auto-generated type definitions for ElevenLabs voices
// Generated at: 2025-07-01T07:56:15.452Z

export interface ElevenLabsVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: 'elevenlabs-tts';
  sampleUrl?: string;
  description: string;
  category: string;
  accent: string;
  age: string;
  useCase: string;
  settings?: Record<string, any>;
  sharing?: Record<string, any>;
  high_quality_base_model_ids?: string[];
  safety_control?: any;
  voice_verification?: Record<string, any>;
  owner_id?: string;
  permission_on_resource?: string;
}

export interface ElevenLabsVoicesData {
  voices: ElevenLabsVoice[];
  metadata: {
    fetchedAt: string;
    totalCount: number;
    apiVersion: string;
    provider: string;
  };
}

declare const elevenLabsVoices: ElevenLabsVoicesData;
export default elevenLabsVoices;
