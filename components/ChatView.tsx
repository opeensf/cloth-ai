import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Volume2, StopCircle, Loader2, Sparkles, User, Bot, X } from 'lucide-react';
import { ChatMessage, ClothingItem, UserProfile } from '../types';
import { chatWithStylist, generateSpeech, suggestOutfits } from '../services/geminiService';
import { decodeBase64, decodeAudioData, fileToBase64, generateId } from '../utils';

interface ChatViewProps {
  wardrobe: ClothingItem[];
  profile: UserProfile;
}

export const ChatView: React.FC<ChatViewProps> = ({ wardrobe, profile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: 'welcome', 
      role: 'model', 
      text: `你好 ${profile.name}！我是你的 StyleMate。我可以帮你利用现有的 ${wardrobe.length} 件衣物搭配造型，建议购买新衣，或者提供时尚建议。上传照片问问我的意见吧！`, 
      timestamp: Date.now() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // Base64
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !pendingImage) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: input,
      image: pendingImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setIsTyping(true);

    try {
      const responseText = await chatWithStylist(userMsg.text, userMsg.image, wardrobe, profile, messages);
      
      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: responseText || "我无言以对！",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setPendingImage(base64);
    }
  };

  const playTTS = async (messageId: string, text: string) => {
    // Stop current audio
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      setPlayingAudioId(null);
    }

    // Toggle off if clicking same button
    if (playingAudioId === messageId) {
      return;
    }

    setPlayingAudioId(messageId);

    try {
      // Check if we already have audio data for this message? 
      // For simplicity in this demo, we fetch fresh every time or could cache it in the message object.
      // Let's fetch fresh for simplicity of state.
      const base64Audio = await generateSpeech(text);
      if (!base64Audio) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioCtx = audioContextRef.current;
      // Resume if suspended (browser policy)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const audioBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioCtx);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;

    } catch (e) {
      console.error("Audio playback error", e);
      setPlayingAudioId(null);
    }
  };

  const generateQuickOutfit = async () => {
      setIsTyping(true);
      const text = await suggestOutfits(wardrobe, profile);
       const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: text || "无法生成穿搭建议。",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-800">AI 穿搭助手</h2>
        </div>
        <button 
            onClick={generateQuickOutfit}
            className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-50 transition"
        >
            ✨ 生成今日穿搭
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] space-y-2`}>
              {msg.image && (
                <img src={msg.image} alt="User upload" className="max-h-48 rounded-lg border border-slate-200" />
              )}
              <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'}`}>
                {msg.text}
              </div>
              {msg.role === 'model' && (
                 <button 
                    onClick={() => playTTS(msg.id, msg.text)}
                    className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-xs transition"
                 >
                    {playingAudioId === msg.id ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    {playingAudioId === msg.id ? "停止" : "朗读"}
                 </button>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        {pendingImage && (
            <div className="relative inline-block mb-2">
                <img src={pendingImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </div>
        )}
        <div className="flex items-center gap-2">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition"
            >
                <ImageIcon className="w-5 h-5" />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload} 
            />
            <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="询问穿搭建议..."
                className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() && !pendingImage}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};