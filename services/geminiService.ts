import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ClothingItem, UserProfile } from "../types";
import { stripBase64Prefix } from "../utils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const VISION_MODEL = "gemini-2.5-flash"; 
const EDIT_MODEL = "gemini-2.5-flash-image"; 
const TTS_MODEL = "gemini-2.5-flash-preview-tts"; 
const CHAT_MODEL = "gemini-3-flash-preview"; 

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isQuotaError = (error: any): boolean => {
  const msg = error?.message || error?.toString() || "";
  return msg.includes("429") || msg.includes("429") || msg.toLowerCase().includes("quota") || msg.includes("Too Many Requests");
};

/**
 * Uses Gemini 2.5 Flash Image to generate a white background version,
 * and Gemini Flash to extract structured metadata (Name, Fit, Description).
 */
export const processClothingImage = async (
  base64Image: string, 
  onProgress?: (status: 'processing_image' | 'analyzing') => void
): Promise<{ processedImage: string, name: string, fit: string, description: string }> => {
  const cleanBase64 = stripBase64Prefix(base64Image);
  
  // 1. Generate/Edit image to have white background
  if (onProgress) onProgress('processing_image');
  
  let processedImage = base64Image;
  try {
    const response = await ai.models.generateContent({
      model: EDIT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: "Generate a professional product shot of this exact clothing item on a pure solid white background. High fidelity. Ensure the item looks isolated.", },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        processedImage = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.warn("Image processing skipped:", error);
    // If it's a quota error, we might still want to proceed with the original image for metadata
    // unless the user specifically wants to stop. For now, we fallback to original image.
    if (isQuotaError(error)) {
       console.warn("Quota exceeded for image generation, using original.");
    }
  }

  // Artificial delay to be gentle on the API
  await delay(1000);

  // 2. Get structured data (Name, Fit, Description) using Vision model
  if (onProgress) onProgress('analyzing');

  let name = "新衣物";
  let fit = "适中";
  let description = "一件好看的衣服";

  try {
    const metadataResponse = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: "分析这件衣物。返回JSON格式数据，包含：name（中文简短名称，如'蓝色牛仔夹克'）、fit（版型，只能是'宽松'、'适中'或'修身'之一）、description（中文简短描述材质风格）。" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            fit: { type: Type.STRING, enum: ["宽松", "适中", "修身"] },
            description: { type: Type.STRING },
          }
        }
      }
    });

    const jsonText = metadataResponse.text;
    if (jsonText) {
      const data = JSON.parse(jsonText);
      if (data.name) name = data.name;
      if (data.fit) fit = data.fit;
      if (data.description) description = data.description;
    }

  } catch (error) {
    console.error("Metadata extraction error:", error);
    if (isQuotaError(error)) {
        // Critical: Throw error so UI knows to stop and show error message
        throw new Error("API_QUOTA_EXCEEDED");
    }
    // For other errors, we can tolerate defaults
  }

  return { processedImage, name, fit, description };
};

export const generateOutfitVisualization = async (
    items: ClothingItem[], 
    profile: UserProfile
): Promise<{ image: string, description: string }> => {
    
    const promptParts: any[] = [];
    items.forEach(item => {
        promptParts.push({
            inlineData: {
                mimeType: 'image/png', 
                data: stripBase64Prefix(item.imageUrl)
            }
        });
    });

    const itemDescriptions = items.map(i => `${i.name} (${i.description})`).join(', ');
    const textPrompt = `
    任务：生成一张逼真的全身穿搭模特图。
    模特特征：性别/外观符合衣物风格，身材${profile.bodyShape}，身高${profile.height}，体重${profile.weight}，肤色${profile.skinTone}。
    穿着衣物：${itemDescriptions}
    要求：高质量全身照，简约背景。同时生成一段中文点评。
    `;
    promptParts.push({ text: textPrompt });

    try {
        const response = await ai.models.generateContent({
            model: EDIT_MODEL,
            contents: { parts: promptParts }
        });

        let generatedImage = "";
        let description = "无法生成描述。";

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                generatedImage = `data:image/png;base64,${part.inlineData.data}`;
            } else if (part.text) {
                description = part.text;
            }
        }

        if (!generatedImage) throw new Error("No image generated");
        return { image: generatedImage, description };

    } catch (error) {
        console.error("Outfit generation error:", error);
        if (isQuotaError(error)) throw new Error("API_QUOTA_EXCEEDED");
        throw error;
    }
}

export const chatWithStylist = async (
  message: string, 
  image: string | undefined, 
  wardrobe: ClothingItem[], 
  profile: UserProfile,
  history: any[]
) => {
  const wardrobeDesc = wardrobe.map(w => `- ${w.name} (${w.fit}, ID: ${w.id}): ${w.description}`).join('\n');
  const profileDesc = `用户: ${profile.name}, ${profile.height}, ${profile.weight}, ${profile.skinTone}, ${profile.bodyShape}, 偏好: ${profile.stylePreferences}`;

  const systemInstruction = `你是一位名为 StyleMate 的 AI 造型师。利用衣橱清单和用户档案提供中文穿搭建议。衣橱:${wardrobeDesc}。档案:${profileDesc}`;

  const parts: any[] = [{ text: message }];
  if (image) {
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: stripBase64Prefix(image) }
    });
  }
  
  try {
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts },
      config: { systemInstruction }
    });
    return response.text;
  } catch (e) {
    console.error("Chat error", e);
    if (isQuotaError(e)) return "API 配额已用完，请稍后重试。";
    return "我现在有点“时尚短路”，请稍后再试。";
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

export const suggestOutfits = async (wardrobe: ClothingItem[], profile: UserProfile) => {
    if (wardrobe.length < 2) return "衣橱里的衣服太少啦，多加几件吧！";
    const wardrobeDesc = wardrobe.map(w => `- ${w.name} (${w.fit})`).join('\n');
    const prompt = `基于用户衣橱: ${wardrobeDesc} 和档案: ${profile.stylePreferences}, ${profile.bodyShape}, ${profile.skinTone}。用中文建议3套穿搭。`;

    try {
        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: { parts: [{ text: prompt }] }
        });
        return response.text;
    } catch (e) {
        if (isQuotaError(e)) return "API 配额已用完，无法生成建议。";
        return "暂时无法生成建议。";
    }
}