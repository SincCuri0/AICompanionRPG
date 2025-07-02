#!/usr/bin/env node

/**
 * Fetch ElevenLabs Voices Script
 * 
 * This script fetches all available voices from the ElevenLabs API
 * and saves them to a local JSON file for static loading.
 * 
 * Usage: node scripts/fetchElevenLabsVoices.js
 * 
 * Environment Variables Required:
 * - ELEVENLABS_API_KEY: Your ElevenLabs API key
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'elevenLabsVoices.json');
const BACKUP_FILE = path.join(OUTPUT_DIR, `elevenLabsVoices.backup.${Date.now()}.json`);

/**
 * Get API key from environment variables
 */
function getApiKey() {
  // Try different possible environment variable names
  const apiKey = process.env.ELEVENLABS_API_KEY
  
  if (!apiKey) {
    console.error('❌ Error: ElevenLabs API key not found!');
    console.error('Please set one of the following environment variables:');
    console.error('  - ELEVENLABS_API_KEY');
    process.exit(1);
  }
  
  return apiKey;
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory() {
  try {
    await fs.access(OUTPUT_DIR);
  } catch (error) {
    console.log(`📁 Creating output directory: ${OUTPUT_DIR}`);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Backup existing voices file if it exists
 */
async function backupExistingFile() {
  try {
    await fs.access(OUTPUT_FILE);
    console.log('📋 Backing up existing voices file...');
    await fs.copyFile(OUTPUT_FILE, BACKUP_FILE);
    console.log(`✅ Backup created: ${BACKUP_FILE}`);
  } catch (error) {
    // File doesn't exist, no backup needed
    console.log('📝 No existing voices file to backup');
  }
}

/**
 * Fetch voices from ElevenLabs API
 */
async function fetchVoices(apiKey) {
  console.log('🔄 Initializing ElevenLabs client...');
  const client = new ElevenLabsClient({ apiKey });
  
  console.log('🎤 Fetching voices from ElevenLabs API...');
  
  try {
    const response = await client.voices.getAll();
    
    if (!response.voices || !Array.isArray(response.voices)) {
      throw new Error('Invalid voices response format');
    }
    
    console.log(`✅ Successfully fetched ${response.voices.length} voices`);
    
    // Debug: Log the first voice to see the structure
    if (response.voices.length > 0) {
      console.log('🔍 First voice structure:', JSON.stringify(response.voices[0], null, 2));
    }
    
    // Transform the voices to match the expected format
    const transformedVoices = response.voices.map((voice) => ({
      id: voice.voiceId || voice.voice_id || voice.id,
      name: voice.name,
      language: voice.labels?.language || 'en',
      gender: voice.labels?.gender || 'neutral',
      provider: 'elevenlabs-tts',
      sampleUrl: voice.previewUrl || voice.preview_url,
      description: voice.description || '',
      category: voice.category || '',
      accent: voice.labels?.accent || '',
      age: voice.labels?.age || '',
      useCase: voice.labels?.use_case || '',
      // Additional metadata
      settings: voice.settings || {},
      sharing: voice.sharing || {},
      high_quality_base_model_ids: voice.highQualityBaseModelIds || voice.high_quality_base_model_ids || [],
      safety_control: voice.safety_control,
      voice_verification: voice.voiceVerification || voice.voice_verification || {},
      owner_id: voice.owner_id,
      permission_on_resource: voice.permission_on_resource
    }));
    
    return {
      voices: transformedVoices,
      metadata: {
        fetchedAt: new Date().toISOString(),
        totalCount: transformedVoices.length,
        apiVersion: 'v2',
        provider: 'elevenlabs-tts'
      }
    };
    
  } catch (error) {
    console.error('❌ Error fetching voices:', error.message);
    
    // Provide specific error guidance
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('🔑 API key appears to be invalid or expired');
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('🚫 API key lacks required permissions');
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      console.error('📊 API quota or rate limit exceeded');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.error('🌐 Network connectivity issue');
    }
    
    throw error;
  }
}

/**
 * Save voices data to JSON file
 */
async function saveVoicesData(voicesData) {
  console.log(`💾 Saving voices data to: ${OUTPUT_FILE}`);
  
  const jsonContent = JSON.stringify(voicesData, null, 2);
  await fs.writeFile(OUTPUT_FILE, jsonContent, 'utf8');
  
  console.log('✅ Voices data saved successfully!');
  
  // Log some statistics
  const { voices, metadata } = voicesData;
  console.log('\n📊 Voice Statistics:');
  console.log(`   Total voices: ${metadata.totalCount}`);
  
  // Count by gender
  const genderCounts = voices.reduce((acc, voice) => {
    acc[voice.gender] = (acc[voice.gender] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(genderCounts).forEach(([gender, count]) => {
    console.log(`   ${gender}: ${count}`);
  });
  
  // Count by language
  const languageCounts = voices.reduce((acc, voice) => {
    acc[voice.language] = (acc[voice.language] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n🌍 Languages:');
  Object.entries(languageCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10) // Top 10 languages
    .forEach(([language, count]) => {
      console.log(`   ${language}: ${count}`);
    });
}

/**
 * Generate TypeScript type definitions
 */
async function generateTypeDefinitions(voicesData) {
  const typeDefPath = path.join(OUTPUT_DIR, 'elevenLabsVoices.d.ts');
  
  const typeDef = `// Auto-generated type definitions for ElevenLabs voices
// Generated at: ${voicesData.metadata.fetchedAt}

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
`;
  
  await fs.writeFile(typeDefPath, typeDef, 'utf8');
  console.log(`📝 Type definitions saved to: ${typeDefPath}`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 ElevenLabs Voice Fetcher');
  console.log('==========================\n');
  
  try {
    // Get API key
    const apiKey = getApiKey();
    console.log(`🔑 API key found (${apiKey.substring(0, 8)}...)`);
    
    // Prepare output directory
    await ensureOutputDirectory();
    
    // Backup existing file
    await backupExistingFile();
    
    // Fetch voices
    const voicesData = await fetchVoices(apiKey);
    
    // Save to file
    await saveVoicesData(voicesData);
    
    // Generate type definitions
    await generateTypeDefinitions(voicesData);
    
    console.log('\n🎉 Voice fetching completed successfully!');
    console.log(`📁 Output file: ${OUTPUT_FILE}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Import the voices in your app: import voicesData from "./data/elevenLabsVoices.json"');
    console.log('   2. Use the static data instead of API calls for better performance');
    console.log('   3. Re-run this script periodically to update voice data');
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();