import React, { useState, useMemo } from 'react';
import { Outfit, ClothingItem } from '../types';
import { X, Calendar, Layers, Heart, Star, TrendingUp, AlertCircle, Trash2 } from 'lucide-react';

interface OutfitViewProps {
  outfits: Outfit[];
  setOutfits: React.Dispatch<React.SetStateAction<Outfit[]>>;
  wardrobe: ClothingItem[];
}

export const OutfitView: React.FC<OutfitViewProps> = ({ outfits, setOutfits, wardrobe }) => {
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Statistics Calculation
  const stats = useMemo(() => {
    const usageMap = new Map<string, number>();
    wardrobe.forEach(item => usageMap.set(item.id, 0));

    outfits.forEach(outfit => {
      outfit.items.forEach(itemId => {
        if (usageMap.has(itemId)) {
          usageMap.set(itemId, (usageMap.get(itemId) || 0) + 1);
        }
      });
    });

    const itemsWithUsage = Array.from(usageMap.entries()).map(([id, count]) => {
      const item = wardrobe.find(i => i.id === id);
      return { item, count };
    }).filter(i => i.item !== undefined) as { item: ClothingItem, count: number }[];

    const sortedByUsage = [...itemsWithUsage].sort((a, b) => b.count - a.count);
    
    return {
      topUsed: sortedByUsage.slice(0, 3).filter(i => i.count > 0),
      neverUsed: sortedByUsage.filter(i => i.count === 0),
      totalOutfits: outfits.length
    };
  }, [outfits, wardrobe]);

  const deleteOutfit = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      
      if(window.confirm("确定要删除这套穿搭吗？")) {
          setOutfits(prev => prev.filter(o => o.id !== id));
      }
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOutfits(prev => prev.map(o => o.id === id ? { ...o, isFavorite: !o.isFavorite } : o));
  };

  const setRating = (e: React.MouseEvent, id: string, rating: number) => {
    e.preventDefault();
    e.stopPropagation();
    setOutfits(prev => prev.map(o => o.id === id ? { ...o, rating } : o));
  }

  const getClothingImages = (itemIds: string[]) => {
      return itemIds.map(id => wardrobe.find(item => item.id === id)).filter(Boolean) as ClothingItem[];
  };

  const displayedOutfits = filterFavorites 
    ? outfits.filter(o => o.isFavorite) 
    : outfits;

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Analytics Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm shrink-0">
          <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800">衣橱利用率分析</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Items */}
              <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">高频单品 (Top 3)</h4>
                  {stats.topUsed.length > 0 ? (
                      <div className="flex gap-3">
                          {stats.topUsed.map(({item, count}) => (
                              <div key={item.id} className="relative group">
                                  <img src={item.imageUrl} className="w-12 h-12 rounded-lg bg-slate-50 object-contain border border-slate-100" title={item.name} />
                                  <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-bold">
                                      {count}
                                  </span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-sm text-slate-400 italic">暂无数据，快去生成穿搭吧！</p>
                  )}
              </div>
              {/* Never Used */}
              <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">冷宫单品 ({stats.neverUsed.length}件)</h4>
                   {stats.neverUsed.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {stats.neverUsed.slice(0, 5).map(({item}) => (
                              <div key={item.id} className="w-10 h-10 shrink-0">
                                  <img src={item.imageUrl} className="w-full h-full rounded-full bg-slate-50 object-contain border border-slate-100 opacity-60 hover:opacity-100 transition" title={item.name} />
                              </div>
                          ))}
                          {stats.neverUsed.length > 5 && (
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                  +{stats.neverUsed.length - 5}
                              </div>
                          )}
                      </div>
                  ) : (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 太棒了！所有衣服都派上用场了。
                      </p>
                  )}
              </div>
          </div>
      </div>

      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">我的穿搭库</h2>
          <p className="text-slate-500 text-sm">已保存 {outfits.length} 套搭配</p>
        </div>
        <button 
          onClick={() => setFilterFavorites(!filterFavorites)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition text-sm font-medium ${filterFavorites ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
            <Heart className={`w-4 h-4 ${filterFavorites ? 'fill-current' : ''}`} />
            只看收藏
        </button>
      </div>

      {displayedOutfits.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-4 bg-slate-50/50">
            <Layers className="w-16 h-16 mb-4 opacity-20" />
            <p>{filterFavorites ? '没有收藏的穿搭。' : '还没有保存的穿搭。'}</p>
            <p className="text-sm mt-1 opacity-70">去衣橱选择几件衣服，让AI为你生成穿搭吧！</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-1 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedOutfits.map(outfit => (
              <div key={outfit.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col shrink-0 h-fit group transition hover:shadow-md">
                <div className="relative aspect-[3/4] bg-slate-50">
                    <img src={outfit.generatedImageUrl} alt="AI Outfit Generation" className="w-full h-full object-cover" />
                    
                    {/* Top Right Actions */}
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button 
                            type="button"
                            onClick={(e) => toggleFavorite(e, outfit.id)}
                            className={`p-2 backdrop-blur rounded-full shadow-sm transition z-10 cursor-pointer ${outfit.isFavorite ? 'bg-red-500 text-white' : 'bg-white/80 text-slate-400 hover:text-red-500 hover:bg-white'}`}
                            title="收藏"
                        >
                            <Heart className={`w-4 h-4 ${outfit.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => deleteOutfit(e, outfit.id)}
                          className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-red-500 hover:bg-white shadow-sm transition z-10 cursor-pointer"
                          title="删除穿搭"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(outfit.createdAt).toLocaleDateString()}
                    </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={(e) => setRating(e, outfit.id, star)}
                                    className="focus:outline-none"
                                >
                                    <Star 
                                        className={`w-4 h-4 transition ${
                                            (outfit.rating || 0) >= star 
                                            ? 'text-yellow-400 fill-current' 
                                            : 'text-slate-200 hover:text-yellow-200'
                                        }`} 
                                    />
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                            {(outfit.rating || 0) > 0 ? `${outfit.rating}星` : '未评分'}
                        </span>
                    </div>

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
        </div>
      )}
    </div>
  );
};

// Helper for 'neverUsed' display in check
function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}