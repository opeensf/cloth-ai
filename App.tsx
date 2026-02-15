import React, { useState, useEffect } from 'react';
import { WardrobeView } from './components/WardrobeView';
import { ChatView } from './components/ChatView';
import { ProfileView } from './components/ProfileView';
import { OutfitView } from './components/OutfitView';
import { ClothingItem, UserProfile, ViewState, Outfit } from './types';
import { Shirt, MessageSquare, UserCircle, Menu, Layers } from 'lucide-react';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('wardrobe');
  
  // App State
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: '时尚达人',
    height: '',
    weight: '',
    skinTone: 'Medium',
    bodyShape: 'Hourglass',
    stylePreferences: '简约大方，舒适为主',
  });

  // Load from Local Storage on Mount
  useEffect(() => {
    const loadedWardrobe = localStorage.getItem('stylemate_wardrobe');
    const loadedProfile = localStorage.getItem('stylemate_profile');
    const loadedOutfits = localStorage.getItem('stylemate_outfits');

    if (loadedWardrobe) setWardrobe(JSON.parse(loadedWardrobe));
    if (loadedProfile) setProfile(JSON.parse(loadedProfile));
    if (loadedOutfits) setOutfits(JSON.parse(loadedOutfits));
  }, []);

  // Save to Local Storage on Change
  useEffect(() => {
    localStorage.setItem('stylemate_wardrobe', JSON.stringify(wardrobe));
  }, [wardrobe]);

  useEffect(() => {
    localStorage.setItem('stylemate_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('stylemate_outfits', JSON.stringify(outfits));
  }, [outfits]);


  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-10">
        <div>
           <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">
               S
             </div>
             <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight text-slate-800">StyleMate</span>
           </div>

           <nav className="p-4 space-y-2">
             <NavButton 
                active={activeView === 'wardrobe'} 
                onClick={() => setActiveView('wardrobe')} 
                icon={<Shirt className="w-5 h-5" />} 
                label="我的衣橱" 
             />
             <NavButton 
                active={activeView === 'outfits'} 
                onClick={() => setActiveView('outfits')} 
                icon={<Layers className="w-5 h-5" />} 
                label="穿搭库" 
             />
             <NavButton 
                active={activeView === 'chat'} 
                onClick={() => setActiveView('chat')} 
                icon={<MessageSquare className="w-5 h-5" />} 
                label="穿搭助手" 
             />
             <NavButton 
                active={activeView === 'profile'} 
                onClick={() => setActiveView('profile')} 
                icon={<UserCircle className="w-5 h-5" />} 
                label="个人档案" 
             />
           </nav>
        </div>

        <div className="p-4 hidden lg:block">
            <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-900 mb-1">衣橱状态</p>
                <div className="w-full bg-indigo-200 h-1.5 rounded-full mb-2">
                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(wardrobe.length * 5, 100)}%` }}></div>
                </div>
                <p className="text-xs text-indigo-700">已添加 {wardrobe.length} 件衣物</p>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <div className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
             <span className="font-bold text-slate-800">StyleMate</span>
             <Menu className="w-5 h-5 text-slate-500" />
        </div>

        <div className="flex-1 overflow-hidden p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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
            {activeView === 'chat' && (
                <div className="h-full max-w-4xl mx-auto">
                    <ChatView wardrobe={wardrobe} profile={profile} />
                </div>
            )}
            {activeView === 'profile' && (
                <ProfileView profile={profile} setProfile={setProfile} />
            )}
        </div>
      </main>
    </div>
  );
};

// Helper Component for Nav
const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl transition-all duration-200 ${
            active 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
        {icon}
        <span className="hidden lg:block font-medium text-sm">{label}</span>
    </button>
);

export default App;