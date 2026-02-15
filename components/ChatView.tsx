import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Volume2, StopCircle, Loader2, Sparkles, User, Bot, X, MessageSquarePlus, Trash2, History, ChevronLeft, PanelRightClose } from 'lucide-react';
import { ChatMessage, ClothingItem, UserProfile, ChatSession } from '../types';
import { chatWithStylist, generateSpeech, suggestOutfits } from '../services/geminiService';
import { decodeBase64, decodeAudioData, fileToBase64, generateId } from '../utils';

interface ChatViewProps {
  wardrobe: ClothingItem[];
  profile: UserProfile;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  onClose?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ wardrobe, profile, sessions, setSessions, onClose }) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // Base64
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize: if no sessions, create one. If sessions exist, load the last one.
  useEffect(() => {
      if (sessions.length === 0) {
          createNewSession();
      } else if (!activeSessionId) {
          // Load most recent
          const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
          loadSession(sorted[0].id);
      }
  }, [sessions]);

  // Sync current messages to active session in parent state
  useEffect(() => {
    if (!activeSessionId) return;

    setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
            // Generate a smart title from first user message if it's default
            let title = s.title;
            if (title === "新对话" && messages.length > 1) {
                const firstUserMsg = messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.text.substring(0, 15) + (firstUserMsg.text.length > 15 ? "..." : "");
                }
            }
            return { ...s, messages: messages, title: title, updatedAt: Date.now() };
        }
        return s;
    }));
  }, [messages]);

  const createNewSession = () => {
      const newSession: ChatSession = {
          id: generateId(),
          title: "新对话",
          updatedAt: Date.now(),
          messages: [{ 
            id: 'welcome', 
            role: 'model', 
            text: `你好 ${profile.name}！我是你的 StyleMate。现有 ${wardrobe.length} 件衣物。请直接告诉我衣物ID（如“用1号和3号搭配”），或上传照片。`, 
            timestamp: Date.now() 
          }]
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages(newSession.messages);
      setShowHistory(false);
  };

  const loadSession = (id: string) => {
      const session = sessions.find(s => s.id === id);
      if (session) {
          setActiveSessionId(id);
          setMessages(session.messages);
          setShowHistory(false);
      }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("确定删除此对话吗？")) {
          setSessions(prev => prev.filter(s => s.id !== id));
          if (activeSessionId === id) {
              setActiveSessionId(null); 
          }
      }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      setPlayingAudioId(null);
    }

    if (playingAudioId === messageId) {
      return;
    }

    setPlayingAudioId(messageId);

    try {
      const base64Audio = await generateSpeech(text);
      if (!base64Audio) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioCtx = audioContextRef.current;
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
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowHistory(true)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                title="历史记录"
            >
                <History className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
                <h2 className="font-bold text-slate-800 text-sm">AI 造型师</h2>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {sessions.find(s => s.id === activeSessionId)?.title || "新对话"}
                </span>
            </div>
        </div>
        
        <div className="flex items-center gap-1">
             <button 
                onClick={generateQuickOutfit}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title="一键建议"
            >
                <Sparkles className="w-4 h-4" />
            </button>
             <button 
                onClick={createNewSession}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                title="新对话"
            >
                <MessageSquarePlus className="w-4 h-4" />
            </button>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>

      {/* History Drawer Overlay */}
      {showHistory && (
          <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col animate-in slide-in-from-left duration-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <h3 className="font-bold text-slate-800">对话历史</h3>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                      <ChevronLeft className="w-5 h-5" />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                 {sessions.sort((a,b) => b.updatedAt - a.updatedAt).map(session => (
                  <div 
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition mb-1 ${activeSessionId === session.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-100'}`}
                  >
                      <div className="flex items-center gap-3 overflow-hidden">
                          <span className={`text-sm truncate ${activeSessionId === session.id ? 'font-medium text-indigo-700' : 'text-slate-600'}`}>
                              {session.title || "新对话"}
                          </span>
                      </div>
                      <button 
                        onClick={(e) => deleteSession(e, session.id)}
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
              ))}
              </div>
          </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[85%] space-y-2`}>
              {msg.image && (
                <img src={msg.image} alt="User upload" className="max-h-32 rounded-lg border border-slate-200 shadow-sm" />
              )}
              <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                {msg.text}
              </div>
              {msg.role === 'model' && (
                <button 
                    onClick={() => playTTS(msg.id, msg.text)}
                    className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-[10px] transition px-1"
                >
                    {playingAudioId === msg.id ? <StopCircle className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    {playingAudioId === msg.id ? "停止" : "朗读"}
                </button>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                  <Bot className="w-3.5 h-3.5" />
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
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        {pendingImage && (
            <div className="relative inline-block mb-2">
                <img src={pendingImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200 shadow-sm" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-1 -right-1 bg-white text-red-500 rounded-full p-0.5 border border-slate-100 shadow-sm hover:bg-red-50"><X className="w-3 h-3" /></button>
            </div>
        )}
        <div className="flex items-end gap-2">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 mb-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition"
                title="上传图片"
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
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="输入消息..."
                rows={1}
                className="flex-1 bg-slate-50 border-transparent hover:bg-white hover:border-slate-300 focus:bg-white border focus:border-indigo-500 rounded-2xl px-4 py-2.5 outline-none text-sm transition-all resize-none max-h-24"
                style={{minHeight: '40px'}}
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() && !pendingImage}
                className="p-2 mb-0.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-indigo-200"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};