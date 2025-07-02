import path from 'path';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig(({ mode }) => {
    // Manually read .env.local to override system variables
    let localApiKey = null;
    let localElevenLabsApiKey = null;
    let localGroqApiKey = null;
    try {
        const envLocal = fs.readFileSync('.env.local', 'utf8');
        const geminiMatch = envLocal.match(/GEMINI_API_KEY=(.+)/);
        if (geminiMatch) {
            localApiKey = geminiMatch[1].trim();
        }
        const elevenLabsMatch = envLocal.match(/ELEVENLABS_API_KEY=(.+)/);
        if (elevenLabsMatch) {
            localElevenLabsApiKey = elevenLabsMatch[1].trim();
        }
        const groqMatch = envLocal.match(/GROQ_API_KEY=(.+)/);
        if (groqMatch) {
            localGroqApiKey = groqMatch[1].trim();
        }
    } catch (e) {
        console.log('No .env.local file found');
    }
    
    // Use local keys if available, otherwise fall back to system
    const apiKey = localApiKey || process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = localElevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
    const groqApiKey = localGroqApiKey || process.env.GROQ_API_KEY;
    
    
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.ELEVENLABS_API_KEY': JSON.stringify(elevenLabsApiKey),
        'process.env.GROQ_API_KEY': JSON.stringify(groqApiKey),
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'vue': 'vue/dist/vue.esm-bundler.js'
        }
      }
    };
});
