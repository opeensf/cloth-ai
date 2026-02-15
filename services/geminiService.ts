import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ClothingItem, UserProfile } from "../types";
import { stripBase64Prefix } from "../utils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
// OPTIMIZATION: Use Flash for analysis to save quota and speed up. Pro is overkill for basic tagging.
const VISION_MODEL = "gemini-2.5-flash"; 
const EDIT_MODEL = "gemini-2.5-flash-image"; // Keep for image editing
const TTS_MODEL = "gemini-2.5-flash-preview-tts"; 
const CHAT_MODEL = "gemini-3-flash-preview"; // Use Flash for basic chat to save quota, switch to Pro if complex reasoning needed

// Helper for delay to avoid rate limits
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: "Generate a professional product shot of this exact clothing item on a pure solid white background. High fidelity. Ensure the item looks isolated.",
          },
        ],
      },
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        processedImage = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image processing warning (likely quota or model error):", error);
    // Fallback to original image if generation fails
  }

  // Artificial delay to be gentle on the API
  await delay(1000);

  // 2. Get structured data (Name, Fit, Description) using Vision model and JSON Schema
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
    description = "获取信息失败 (API配额不足)";
  }

  return { processedImage, name, fit, description };
};

/**
 * Generates an outfit visualization using Gemini 2.5 Flash Image (Nano Banana).
 * It takes the selected clothing items and the user profile to generate a composite image.
 */
export const generateOutfitVisualization = async (
    items: ClothingItem[], 
    profile: UserProfile
): Promise<{ image: string, description: string }> => {
    
    // Prepare prompt parts: Text prompt + Images of clothes
    const promptParts: any[] = [];

    // 1. Add images of the clothes
    items.forEach(item => {
        promptParts.push({
            inlineData: {
                mimeType: 'image/png', // Assuming png/jpeg
                data: stripBase64Prefix(item.imageUrl) // Use the processed white bg image
            }
        });
    });

    // 2. Construct the prompt
    const itemDescriptions = items.map(i => `${i.name} (${i.description})`).join(', ');
    
    const textPrompt = `
    任务：生成一张逼真的全身穿搭模特图。
    
    模特特征：
    - 性别/外观：符合通常穿着这些衣服的形象。
    - 身材：${profile.bodyShape}，身高 ${profile.height}，体重 ${profile.weight}。
    - 肤色：${profile.skinTone}。
    
    穿着衣物（请参考提供的图片）：
    ${itemDescriptions}
    
    要求：
    1. 生成一张高质量的图片，展示模特穿着这些衣服的效果。背景为简约的室内或街拍背景。
    2. 同时生成一段中文文本，点评这套穿搭的亮点，适合什么场合（例如约会、职场、休闲）。
    `;

    promptParts.push({ text: textPrompt });

    try {
        const response = await ai.models.generateContent({
            model: EDIT_MODEL, // Using Nano Banana / Flash Image
            contents: {
                parts: promptParts
            }
        });

        let generatedImage = "";
        let description = "无法生成描述。";

        // Extract content
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                generatedImage = `data:image/png;base64,${part.inlineData.data}`;
            } else if (part.text) {
                description = part.text;
            }
        }

        if (!generatedImage) {
             throw new Error("No image generated");
        }

        return { image: generatedImage, description };

    } catch (error) {
        console.error("Outfit generation error:", error);
        throw error;
    }
}

/**
 * Chat with the Stylist using Gemini 3 Pro.
 * Includes Wardrobe and Profile context.
 */
export const chatWithStylist = async (
  message: string, 
  image: string | undefined, 
  wardrobe: ClothingItem[], 
  profile: UserProfile,
  history: any[]
) => {
  
  // Construct context
  const wardrobeDesc = wardrobe.map(w => `- ${w.name} (${w.fit}, ID: ${w.id}): ${w.description}`).join('\n');
  const profileDesc = `
    用户档案:
    姓名: ${profile.name}
    身高: ${profile.height}
    体重: ${profile.weight}
    肤色: ${profile.skinTone}
    身型: ${profile.bodyShape}
    风格偏好: ${profile.stylePreferences}
  `;

  const systemInstruction = `
    你是一位名为 StyleMate 的世界级个人 AI 造型师。
    你可以访问用户的数字衣橱和身体档案。
    
    当前衣橱清单:
    ${wardrobeDesc || "衣橱是空的。"}
    
    ${profileDesc}
    
    你的目标:
    1. 利用衣橱里的现有衣物搭配出合适的造型。
    2. 建议购买可以填补衣橱空白的单品。
    3. 根据用户的身型、肤色提供个性化的穿搭建议。
    4. 语气要亲切、时尚、鼓励且乐于助人。
    
    请始终使用中文（简体）与用户交流。
  `;

  const parts: any[] = [{ text: message }];
  if (image) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: stripBase64Prefix(image)
      }
    });
  }
  
  try {
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
      }
    });
    return response.text;
  } catch (e) {
    console.error("Chat error", e);
    return "我现在有点“时尚短路”（网络错误/API配额超限）。请稍后再试？";
  }
};

/**
 * Generate Speech from Text using Gemini 2.5 Flash TTS
 */
export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

/**
 * Suggest Outfits based on Wardrobe
 */
export const suggestOutfits = async (wardrobe: ClothingItem[], profile: UserProfile) => {
    if (wardrobe.length < 2) return "我需要你的衣橱里至少有几件衣服才能给你建议哦！";

    const wardrobeDesc = wardrobe.map(w => `- ${w.name} (${w.fit})`).join('\n');
    const prompt = `
      基于用户的衣橱:
      ${wardrobeDesc}
      
      以及个人档案: 风格偏好 ${profile.stylePreferences}, 身型 ${profile.bodyShape}, 肤色 ${profile.skinTone}
      
      请用中文建议 3 套不同的穿搭方案。
      另外，推荐 1 件他们应该购买以完善衣橱的单品。
      请使用清晰的排版（加粗标题）。
    `;

    try {
        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: { parts: [{ text: prompt }] }
        });
        return response.text;
    } catch (e) {
        return "暂时无法生成建议（可能是API配额超限，请稍后再试）。";
    }
}