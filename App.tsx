import React, { useState, useEffect, ReactNode } from 'react';
import { WardrobeView } from './components/WardrobeView';
import { ChatView } from './components/ChatView';
import { ProfileView } from './components/ProfileView';
import { OutfitView } from './components/OutfitView';
import { ClothingItem, UserProfile, ViewState, Outfit, ChatSession } from './types';
import { Shirt, MessageSquare, UserCircle, Menu, Layers, AlertTriangle, Trash2, X, Sparkles, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { compressBase64 } from './utils';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
      if(window.confirm("这将清除所有本地存储的数据，应用将重置为初始状态。确定吗？")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center">
           <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full flex flex-col items-center">
               <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
               <h1 className="text-2xl font-bold mb-2 text-slate-900">应用崩溃了</h1>
               <p className="text-slate-500 mb-6 leading-relaxed">
                   检测到严重错误（通常是由于图片数据占用内存过大）。<br/>
                   请尝试刷新。如果问题依旧，请重置数据。
               </p>
               <div className="flex gap-4 w-full">
                   <button onClick={() => window.location.reload()} className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-indigo-700 transition">
                     刷新页面
                   </button>
                   <button onClick={this.handleReset} className="flex-1 bg-white border border-red-200 text-red-500 px-4 py-3 rounded-xl font-medium hover:bg-red-50 transition flex items-center justify-center gap-2">
                     <Trash2 className="w-4 h-4" /> 重置数据
                   </button>
               </div>
           </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('wardrobe');
  const [isChatOpen, setIsChatOpen] = useState(true); // Default open on desktop
  
  // App State
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]); // New Chat Persistence
  const [profile, setProfile] = useState<UserProfile>({
    name: '时尚达人',
    height: '',
    weight: '',
    skinTone: 'Medium',
    bodyShape: 'Hourglass',
    stylePreferences: '简约大方，舒适为主',
  });
  const [isSanitizing, setIsSanitizing] = useState(true);

  // Responsive: Close chat by default on small screens
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsChatOpen(false);
    }
  }, []);

  // Load and Sanitize Data on Mount
  useEffect(() => {
    const initData = async () => {
      try {
        const loadedWardrobeStr = localStorage.getItem('stylemate_wardrobe');
        const loadedProfile = localStorage.getItem('stylemate_profile');
        const loadedOutfits = localStorage.getItem('stylemate_outfits');
        const loadedSessions = localStorage.getItem('stylemate_sessions');

        if (loadedProfile) setProfile(JSON.parse(loadedProfile));
        if (loadedOutfits) setOutfits(JSON.parse(loadedOutfits));
        if (loadedSessions) setChatSessions(JSON.parse(loadedSessions));

        if (loadedWardrobeStr) {
            const items: ClothingItem[] = JSON.parse(loadedWardrobeStr);
            
            // MEMORY PROTECTION: Sanitize existing large images
            const sanitizedItems = await Promise.all(items.map(async (item) => {
                delete item.originalImage;
                if (item.imageUrl && item.imageUrl.length > 200000) {
                    try {
                        item.imageUrl = await compressBase64(item.imageUrl);
                    } catch (err) {
                        console.warn("Failed to compress item during sanitization", err);
                    }
                }
                return item;
            }));
            
            setWardrobe(sanitizedItems);
            try {
                localStorage.setItem('stylemate_wardrobe', JSON.stringify(sanitizedItems));
            } catch (e) {
                console.error("Storage full during sanitization save", e);
            }
        }
      } catch (e) {
        console.error("Failed to load local storage", e);
      } finally {
          setIsSanitizing(false);
      }
    };

    initData();
  }, []);

  // Safe Save to Local Storage
  useEffect(() => {
    if (isSanitizing) return;
    try {
      localStorage.setItem('stylemate_wardrobe', JSON.stringify(wardrobe));
    } catch (e) {
      console.error("Storage limit reached", e);
    }
  }, [wardrobe, isSanitizing]);

  useEffect(() => {
    localStorage.setItem('stylemate_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    try {
        localStorage.setItem('stylemate_outfits', JSON.stringify(outfits));
    } catch (e) {
        console.error("Storage limit reached for outfits", e);
    }
  }, [outfits]);

  useEffect(() => {
    try {
        localStorage.setItem('stylemate_sessions', JSON.stringify(chatSessions));
    } catch (e) {
        console.error("Storage limit reached for chats", e);
    }
  }, [chatSessions]);

  if (isSanitizing) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-indigo-600">
              <div className="animate-spin mb-4">
                 <Layers className="w-10 h-10" />
              </div>
              <p className="font-medium animate-pulse">正在优化衣橱数据...</p>
              <p className="text-xs text-slate-400 mt-2">为防止崩溃，正在压缩历史图片</p>
          </div>
      );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
        
        {/* Sidebar Navigation */}
        <aside className="w-20 bg-white border-r border-slate-200 flex flex-col justify-between z-30 shrink-0">
          <div>
            <div className="h-16 flex items-center justify-center border-b border-slate-100">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">
                S
              </div>
            </div>

            <nav className="p-3 space-y-4 mt-4">
              <NavTooltip label="我的衣橱">
                <NavButton 
                    active={activeView === 'wardrobe'} 
                    onClick={() => setActiveView('wardrobe')} 
                    icon={<Shirt className="w-6 h-6" />} 
                />
              </NavTooltip>
              <NavTooltip label="穿搭库">
                <NavButton 
                    active={activeView === 'outfits'} 
                    onClick={() => setActiveView('outfits')} 
                    icon={<Layers className="w-6 h-6" />} 
                />
              </NavTooltip>
              <NavTooltip label="个人档案">
                <NavButton 
                    active={activeView === 'profile'} 
                    onClick={() => setActiveView('profile')} 
                    icon={<UserCircle className="w-6 h-6" />} 
                />
              </NavTooltip>
            </nav>
          </div>

          <div className="p-3 mb-4">
             <div className="w-full h-px bg-slate-100 mb-4"></div>
             <NavTooltip label={isChatOpen ? "关闭助手" : "打开助手"}>
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-300 ${isChatOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white shadow-lg shadow-slate-300'}`}
                >
                  {isChatOpen ? <PanelRightClose className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                </button>
             </NavTooltip>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-300`}>
          {/* Mobile Header */}
          <div className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
              <span className="font-bold text-slate-800">StyleMate</span>
              <button onClick={() => setIsChatOpen(!isChatOpen)} className="text-slate-500">
                <MessageSquare className="w-5 h-5" />
              </button>
          </div>

          <div className="flex-1 overflow-hidden p-4 md:p-6 max-w-7xl mx-auto w-full">
              {activeView === 'wardrobe' && (
                  <WardrobeView 
                      wardrobe={wardrobe} 
                      setWardrobe={setWardrobe} 
                      profile={profile}
                      addOutfit={(newOutfit) => setOutfits(prev => [newOutfit, ...prev])}
                      goToOutfits={() => setActiveView('outfits')}
                  />
              )}
              {activeView === 'outfits' && (
                  <OutfitView outfits={outfits} setOutfits={setOutfits} wardrobe={wardrobe} />
              )}
              {activeView === 'profile' && (
                  <ProfileView profile={profile} setProfile={setProfile} />
              )}
          </div>
        </main>

        {/* Global Chat Sidebar */}
        {isChatOpen && (
          <div className="w-full md:w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 absolute inset-0 md:static md:inset-auto h-full flex flex-col animate-in slide-in-from-right duration-300">
             <ChatView 
                wardrobe={wardrobe} 
                profile={profile} 
                sessions={chatSessions}
                setSessions={setChatSessions}
                onClose={() => setIsChatOpen(false)}
             />
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode }> = ({ active, onClick, icon }) => (
    <button 
        onClick={onClick}
        className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${
            active 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
            : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
        }`}
    >
        {icon}
    </button>
);

const NavTooltip: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
      {label}
    </div>
  </div>
);

export default App;