
// Audio Decoding Utilities for Gemini TTS (Raw PCM)
export function decodeBase64(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0);
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decode error", e);
    return new Uint8Array(0);
  }
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  if (data.length === 0) {
      // Return silent buffer to prevent crash
      return ctx.createBuffer(numChannels, 1, sampleRate);
  }
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount || 1, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Image Utilities

/**
 * Compresses an existing Base64 string if it's too large.
 */
export const compressBase64 = (base64: string, maxDimension: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    // If image is already small (< 100KB), return as is to save CPU
    if (base64.length < 100 * 1024) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Keep aspect ratio
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height *= maxDimension / width));
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width *= maxDimension / height));
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const newBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(newBase64);
    };
    img.onerror = () => {
        // If loading fails, return original or empty to prevent crash
        resolve(base64); 
    };
  });
};

/**
 * Compresses and resizes an image file.
 * Tuned for max 800px and 0.6 quality to fit within LocalStorage limits.
 */
export const compressImage = (file: File, maxDimension: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height *= maxDimension / width));
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width *= maxDimension / height));
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(event.target?.result as string);
            return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const stripBase64Prefix = (base64: string | undefined | null): string => {
  if (!base64) return "";
  const str = String(base64);
  return str.replace(/^data:image\/[a-z]+;base64,/, "");
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Generates a sequential ID (1, 2, 3...) based on existing items.
 * Falls back to 1 if empty.
 */
export const getNextSimpleId = (items: { id: string }[]): string => {
  let maxId = 0;
  items.forEach(item => {
    const num = parseInt(item.id, 10);
    if (!isNaN(num) && num > maxId) {
      maxId = num;
    }
  });
  return (maxId + 1).toString();
};
