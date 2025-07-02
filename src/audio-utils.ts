/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Decode base64 string to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encode Uint8Array to base64 string
function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
  }
  return {
    data: encodeBytes(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000', // Standard PCM MIME type for 16kHz
  };
}

export async function decodeAudioData(
    base64Data: string, // Expect base64 string for raw audio data from server
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
  const dataBytes = decodeBase64(base64Data); // Decode base64 to Uint8Array
  // The incoming data is likely Int16 PCM, so we need to convert it to Float32 for AudioBuffer
  const dataInt16 = new Int16Array(dataBytes.buffer);
  const dataFloat32 = new Float32Array(dataInt16.length);
  for (let i = 0; i < dataInt16.length; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0; // Convert Int16 to Float32 range [-1.0, 1.0]
  }
  
  // Create an AudioBuffer with the correct number of channels and frames
  // The number of frames is total samples / number of channels
  const buffer = ctx.createBuffer(
      numChannels,
      dataFloat32.length / numChannels,
      sampleRate,
  );

  // De-interleave if multi-channel, or copy directly if mono
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channelData = new Float32Array(dataFloat32.length / numChannels);
      for (let j = 0, k = 0; j < dataFloat32.length; j += numChannels) {
        channelData[k++] = dataFloat32[j + i];
      }
      buffer.copyToChannel(channelData, i);
    }
  }
  return buffer;
}
