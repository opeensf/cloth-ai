import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ClothingItem, UserProfile } from "../types";
import { stripBase64Prefix } from "../utils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const VISION_MODEL = "gemini-2.5-flash"; 
const EDIT_MODEL = "gemini-2.5-flash-image"; 
const TTS_MODEL = "gemini-2.5-flash-preview-tts"; 
const CHAT_MODEL = "gemini-3-flash-preview"; 

// Helper: Safely clean JSON string from Markdown code blocks
const cleanJsonString = (text: string): string => {
  if (!text) return "{}";
  // Remove ```json and ``` markers
  let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return clean;
};

const isQuotaError = (error: any): boolean => {
  const msg = error?.message || error?.toString() || "";
  return msg.includes("429") || msg.includes("429") || msg.toLowerCase().includes("quota") || msg.includes("Too Many Requests");
};

// Helper: Safely get text from response, handling Safety filters which cause .text to throw
const safeGetText = (response: any): string => {
  try {
    // Check if candidates exist
    if (!response.candidates || response.candidates.length === 0) return "";
    
    // Check for safety finish reason
    const candidate = response.candidates[0];
    if (candidate.finishReason !== "STOP" && candidate.finishReason !== undefined) {
      console.warn("AI Response stopped due to:", candidate.finishReason);
      if (candidate.finishReason === "SAFETY") return ""; 
    }

    return response.text || "";
  } catch (e) {
    console.warn("Could not extract text from response (likely blocked):", e);
    return "";
  }
};

/**
 * OPTIMIZED: Uses Promise.all to run background removal and metadata analysis in parallel.
 */
export const processClothingImage = async (
  base64Image: string, 
  onProgress?: (status: 'processing_image' | 'analyzing') => void
): Promise<{ processedImage: string, name: string, fit: string, description: string, category: string }> => {
  const cleanBase64 = stripBase64Prefix(base64Image);
  
  if (onProgress) onProgress('analyzing'); // Update status generic "analyzing/processing"

  // -- 1. Define Promises for Parallel Execution --

  // Task A: Generate White Background Image
  const bgRemovalPromise = (async (): Promise<string> => {
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
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
        }
        return base64Image; // Fallback to original
      } catch (error) {
        console.warn("Image processing skipped/failed:", error);
        return base64Image; // Fallback
      }
  })();

  // Task B: Extract Metadata (JSON)
  const metadataPromise = (async (): Promise<{name: string, fit: string, category: string, description: string}> => {
      let name = "新衣物";
      let fit = "适中";
      let category = "未分类";
      let description = "一件好看的衣服";

      try {
        const metadataResponse = await ai.models.generateContent({
          model: VISION_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
              { text: "分析这件衣物。返回JSON格式数据。字段要求：\n1. name: 中文名称，必须极简，**禁止重复堆砌词语**，最多8个字（例如'蓝色条纹领带'）。\n2. category: 类别，如'上装'、'下装'、'鞋靴'、'领带'、'配饰'等。\n3. fit: 版型，只能是'宽松'、'适中'、'修身'、'均码'之一。\n4. description: 中文简短描述材质风格。" }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                fit: { type: Type.STRING, enum: ["宽松", "适中", "修身", "均码"] },
                description: { type: Type.STRING },
              }
            }
          }
        });

        const rawText = safeGetText(metadataResponse);
        const jsonText = cleanJsonString(rawText);

        if (jsonText && jsonText !== "{}") {
            const data = JSON.parse(jsonText);
            if (data.name) name = data.name;
            if (data.fit) fit = data.fit;
            if (data.category) category = data.category;
            if (data.description) description = data.description;

            // Post-processing cleanup
            if (name.length > 20) name = name.substring(0, 12) + "...";
            if (name.length > 4) {
                const half = Math.floor(name.length / 2);
                if (name.substring(0, half) === name.substring(half, half * 2)) {
                    name = name.substring(0, half);
                }
            }
        }
      } catch (error) {
         console.error("Metadata extraction error:", error);
         if (isQuotaError(error)) throw new Error("API_QUOTA_EXCEEDED");
      }
      return { name, fit, category, description };
  })();

  // -- 2. Await both --
  const [processedImage, metadata] = await Promise.all([bgRemovalPromise, metadataPromise]);

  return { 
      processedImage, 
      name: metadata.name, 
      fit: metadata.fit, 
      description: metadata.description, 
      category: metadata.category 
  };
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
    
    // Updated Prompt: Concise, Structured, Objective.
    const textPrompt = `
    [IMAGE GENERATION TASK]
    Generate a realistic full-body photo of a model wearing these items.
    Model: Handsome Chinese male university student, 185cm, 71kg, Glasses, Textured Fringe Hair, Youthful/Clean vibe.
    Items: ${itemDescriptions}.
    Shoes: White Sneakers.
    Requirements:
    1. STRICTLY PRESERVE item details (color, pattern, logo).
    2. Natural fit and lighting.
    3. Minimalist studio background.

    [TEXT GENERATION TASK]
    生成一段中文点评。
    要求：
    1. **结构清晰**，分三点回答：【视觉效果】、【适用场景】、【色彩分析】。
    2. **语言简练客观**，不要过度吹捧（禁止使用“完美”、“绝美”、“惊艳”等夸张词汇），点到为止。
    3. 总字数控制在100字以内。
    `;
    promptParts.push({ text: textPrompt });

    try {
        const response = await ai.models.generateContent({
            model: EDIT_MODEL,
            contents: { parts: promptParts },
            config: {
                imageConfig: { aspectRatio: "3:4" }
            }
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
  const profileDesc = `用户: 帅气中国男大学生, 185cm, 71kg, 少年感, 戴眼镜, 发型: 微分碎盖, 偏好: ${profile.stylePreferences}`;

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
    return safeGetText(response);
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
    const prompt = `基于用户衣橱: ${wardrobeDesc}。模特为185cm 71kg 帅气中国男大学生，戴眼镜，发型为微分碎盖，气质少年感。用中文建议3套适合校园或约会的穿搭。`;

    try {
        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: { parts: [{ text: prompt }] }
        });
        return safeGetText(response);
    } catch (e) {
        if (isQuotaError(e)) return "API 配额已用完，无法生成建议。";
        return "暂时无法生成建议。";
    }
}