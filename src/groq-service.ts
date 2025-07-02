/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import Groq from "groq-sdk";

export class GroqService {
  private apiKey: string;
  private groq: Groq | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // In development, use Groq SDK directly
    if (import.meta.env.DEV) {
      this.groq = new Groq({ 
        apiKey, 
        dangerouslyAllowBrowser: true 
      });
    }
  }

  async generateResponse(systemPrompt: string, userMessage: string, useJsonFormat = false): Promise<string> {
    try {
      console.log('[Groq] Sending request to Llama-3.1-8b-instant');
      
      if (import.meta.env.DEV && this.groq) {
        // Development: Use Groq SDK directly
        const requestBody: any = {
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.8,
          max_tokens: 1024,
        };

        // Only add JSON format for character generation
        if (useJsonFormat) {
          requestBody.response_format = {"type": "json_object"};
        }

        const completion = await this.groq.chat.completions.create(requestBody);

        const responseText = completion.choices[0]?.message?.content;
        
        if (!responseText) {
          throw new Error('No response generated from Groq');
        }

        console.log('[Groq] Generated response:', responseText);
        return responseText.trim();
      } else {
        // Production: Use fetch to Vercel API route
        const requestBody: any = {
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.8,
          max_tokens: 1024,
        };

        // Only add JSON format for character generation
        if (useJsonFormat) {
          requestBody.response_format = {"type": "json_object"};
        }

        const response = await fetch('/api/groq', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const responseText = data.choices[0]?.message?.content;
        
        if (!responseText) {
          throw new Error('No response generated from Groq');
        }

        console.log('[Groq] Generated response:', responseText);
        return responseText.trim();
      }
    } catch (error) {
      console.error('Failed to generate response with Groq:', error);
      throw error;
    }
  }
}