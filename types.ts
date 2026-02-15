export interface ClothingItem {
  id: string;
  imageUrl: string; // Base64 or URL
  originalImage?: string;
  category: string;
  description: string;
  name: string; // Added: Short name
  fit: string; // '宽松' | '适中' | '修身'
  color?: string;
  season?: string[];
  addedAt: number;
}

export interface Outfit {
  id: string;
  items: string[]; // IDs of clothing items
  generatedImageUrl: string; // The AI generated model look
  description: string;
  createdAt: number;
  isFavorite?: boolean; // New: Favorite status
  rating?: number; // New: User rating (0-5)
}

export interface UserProfile {
  name: string;
  height: string;
  weight: string;
  skinTone: string;
  bodyShape: string;
  stylePreferences: string;
  avatarUrl?: string; // Optional user photo
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 of uploaded image for analysis
  timestamp: number;
  audioData?: string; // Base64 audio for TTS
  isAudioPlaying?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type ViewState = 'wardrobe' | 'profile' | 'outfits';