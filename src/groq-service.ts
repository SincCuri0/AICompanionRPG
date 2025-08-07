/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import Groq from "groq-sdk";

/**
 * Utility function to clean JSON response from Groq that might be wrapped in markdown code blocks
 */
export function cleanJsonResponse(response: string): string {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }

  // Remove any leading/trailing text that might not be JSON
  // Look for the first { and last } to extract just the JSON part
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  return jsonStr;
}

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

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    useJsonFormat = false,
    options: {
      useStructuredOutput?: boolean;
      jsonSchema?: object;
      useCreativeModel?: boolean;
      temperature?: number;
    } = {}
  ): Promise<string> {
    try {
      // Choose model based on structured output support
      let model: string;
      if (options.useStructuredOutput && options.jsonSchema) {
        // Use a model that supports structured outputs
        model = "meta-llama/llama-4-maverick-17b-128e-instruct";
      } else {
        // Use regular models for non-structured generation
        model = options.useCreativeModel ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
      }
      const temperature = options.temperature ?? (options.useCreativeModel ? 1.2 : 0.8);

      // Generate random seed for variety
      const randomSeed = Math.floor(Math.random() * 1000000);
      console.log(`[Groq] Sending request to ${model} with temperature ${temperature}, seed ${randomSeed}`);

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
          model,
          temperature,
          max_tokens: 2048,
          seed: randomSeed, // Random seed for variety
        };

        // Handle different output formats
        if (options.useStructuredOutput && options.jsonSchema) {
          // Use Groq's structured outputs with JSON Schema
          requestBody.response_format = {
            type: "json_schema",
            json_schema: {
              name: "scene_generation",
              schema: options.jsonSchema,
              strict: true
            }
          };
        } else if (useJsonFormat) {
          // Fallback to basic JSON object mode
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

        // Choose model based on structured output support (same logic as dev)
        let model: string;
        if (options.useStructuredOutput && options.jsonSchema) {
          // Use a model that supports structured outputs
          model = "meta-llama/llama-4-maverick-17b-128e-instruct";
        } else {
          // Use regular models for non-structured generation
          model = options.useCreativeModel ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
        }

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
          model,
          temperature,
          max_tokens: 2048,
          seed: randomSeed, // Random seed for variety
        };

        // Handle different output formats (same logic as dev)
        if (options.useStructuredOutput && options.jsonSchema) {
          // Use Groq's structured outputs with JSON Schema
          requestBody.response_format = {
            type: "json_schema",
            json_schema: {
              name: "scene_generation",
              schema: options.jsonSchema,
              strict: true
            }
          };
        } else if (useJsonFormat) {
          // Fallback to basic JSON object mode
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