import React from 'react';
import { Outfit, ClothingItem } from '../types';
import { X, Calendar, Layers } from 'lucide-react';

interface OutfitViewProps {
  outfits: Outfit[];
  setOutfits: React.Dispatch<React.SetStateAction<Outfit[]>>;
  wardrobe: ClothingItem[];
}

export const OutfitView: React.FC<OutfitViewProps> = ({ outfits, setOutfits, wardrobe }) => {
  
  const deleteOutfit = (id: string) => {
      if(window.confirm("确定要删除这套穿搭吗？")) {
          setOutfits(prev => prev.filter(o => o.id !== id));
      }
  };

  const getClothingImages = (itemIds: string[]) => {
      return itemIds.map(id => wardrobe.find(item => item.id === id)).filter(Boolean) as ClothingItem[];
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">我的穿搭库</h2>
          <p className="text-slate-500 text-sm">已保存 {outfits.length} 套搭配</p>
        </div>
      </div>

      {outfits.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-4 bg-slate-50/50">
            <Layers className="w-16 h-16 mb-4 opacity-20" />
            <p>还没有保存的穿搭。</p>
            <p className="text-sm mt-1 opacity-70">去衣橱选择几件衣服，让AI为你生成穿搭吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-20">
          {outfits.map(outfit => (
            <div key={outfit.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="relative aspect-[3/4] bg-slate-50">
                  <img src={outfit.generatedImageUrl} alt="AI Outfit Generation" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => deleteOutfit(outfit.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-red-500 hover:bg-white shadow-sm transition"
                  >
                      <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(outfit.createdAt).toLocaleDateString()}
                  </div>
              </div>
              
              <div className="p-4 flex-1 flex flex-col">
                  <div className="mb-3">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{outfit.description}</p>
                  </div>
                  
                  <div className="mt-auto pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2 font-medium">包含单品:</p>
                      <div className="flex -space-x-2 overflow-hidden">
                          {getClothingImages(outfit.items).map((item, idx) => (
                              <img 
                                key={idx}
                                src={item.imageUrl} 
                                title={item.name}
                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover bg-slate-100" 
                              />
                          ))}
                      </div>
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};