import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2, Shirt, Edit2, UploadCloud, Save, CheckCircle2, Wand2, ImagePlus, AlertCircle, RefreshCw } from 'lucide-react';
import { ClothingItem, Outfit, UserProfile } from '../types';
import { processClothingImage, generateOutfitVisualization, delay } from '../services/geminiService';
import { fileToBase64, generateId } from '../utils';

interface WardrobeViewProps {
  wardrobe: ClothingItem[];
  setWardrobe: React.Dispatch<React.SetStateAction<ClothingItem[]>>;
  profile: UserProfile;
  addOutfit: (outfit: Outfit) => void;
  goToOutfits: () => void;
}

// Upload Task Interface
interface UploadTask {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing_image' | 'analyzing' | 'complete' | 'error';
  errorMessage?: string;
}

export const WardrobeView: React.FC<WardrobeViewProps> = ({ wardrobe, setWardrobe, profile, addOutfit, goToOutfits }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  
  // Selection State for Outfit Creation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);

  // Upload Queue State
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to process the queue sequentially
  useEffect(() => {
    const processNext = async () => {
      if (isProcessingQueue) return;

      const nextTask = uploadQueue.find(t => t.status === 'pending');
      if (!nextTask) return;

      setIsProcessingQueue(true);

      try {
        await processUploadTask(nextTask);
        // Important: Add a delay between tasks to avoid API Rate Limit Exceeded
        await delay(2000); 
      } catch (e) {
        console.error("Queue process logic error", e);
      } finally {
        setIsProcessingQueue(false);
      }
    };

    processNext();
  }, [uploadQueue, isProcessingQueue]);


  // Handle processing of a single file from the queue
  const processUploadTask = async (task: UploadTask) => {
    try {
      const base64 = await fileToBase64(task.file);
      
      updateTaskStatus(task.id, 'processing_image');

      const { processedImage, name, fit, description } = await processClothingImage(
        base64,
        (status) => updateTaskStatus(task.id, status)
      );
      
      const newItem: ClothingItem = {
        id: generateId(),
        imageUrl: processedImage,
        originalImage: base64,
        category: '未分类',
        name: name,
        fit: fit,
        description: description,
        addedAt: Date.now(),
      };

      setWardrobe(prev => [newItem, ...prev]);
      updateTaskStatus(task.id, 'complete');
      
      // Remove from queue after success
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(t => t.id !== task.id));
      }, 2000);

    } catch (error: any) {
      console.error("Task failed:", error);
      let errMsg = "处理失败";
      
      if (error.message === "API_QUOTA_EXCEEDED" || error.toString().includes("API_QUOTA_EXCEEDED")) {
          errMsg = "API 配额不足";
      }

      setUploadQueue(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'error', errorMessage: errMsg } : t
      ));
    }
  };

  const updateTaskStatus = (id: string, status: UploadTask['status']) => {
    setUploadQueue(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const retryTask = (id: string) => {
      setUploadQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'pending', errorMessage: undefined } : t));
  };

  const removeTask = (id: string) => {
      setUploadQueue(prev => prev.filter(t => t.id !== id));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTasks: UploadTask[] = [];

    // Create tasks for all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const preview = URL.createObjectURL(file);
      const task: UploadTask = {
        id: generateId(),
        file,
        preview,
        status: 'pending'
      };
      newTasks.push(task);
    }

    setUploadQueue(prev => [...prev, ...newTasks]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const deleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (window.confirm("确定要删除这件衣物吗？")) {
        setWardrobe(prev => prev.filter(item => item.id !== id));
        if (selectedIds.has(id)) {
            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
        }
    }
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setWardrobe(prev => prev.map(item => item.id === editingItem.id ? editingItem : item));
    setEditingItem(null);
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleCreateOutfit = async () => {
      if (selectedIds.size === 0) return;
      setIsGeneratingOutfit(true);

      const selectedItems = wardrobe.filter(item => selectedIds.has(item.id));

      try {
          const { image, description } = await generateOutfitVisualization(selectedItems, profile);

          const newOutfit: Outfit = {
              id: generateId(),
              items: Array.from(selectedIds),
              generatedImageUrl: image,
              description: description,
              createdAt: Date.now()
          };

          addOutfit(newOutfit);
          setSelectedIds(new Set()); 
          if(window.confirm("穿搭生成成功！是否前往穿搭页面查看？")) {
              goToOutfits();
          }

      } catch (e: any) {
          console.error(e);
          if (e.message === "API_QUOTA_EXCEEDED" || e.toString().includes("API_QUOTA_EXCEEDED")) {
              alert("API 配额不足，无法生成穿搭。请稍后再试。");
          } else {
              alert("生成穿搭失败，请重试。");
          }
      } finally {
          setIsGeneratingOutfit(false);
      }
  };

  const getStatusText = (task: UploadTask) => {
      if (task.errorMessage) return task.errorMessage;
      switch (task.status) {
          case 'pending': return '等待处理...';
          case 'processing_image': return '正在去除背景...';
          case 'analyzing': return '正在分析款式...';
          case 'complete': return '完成！';
          default: return '处理中...';
      }
  };

  return (
    <div 
        className={`h-full flex flex-col relative transition-colors duration-200 ${isDragging ? 'bg-indigo-50/50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
    >
      {/* Overlay for drag drop hint */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm border-2 border-indigo-500 border-dashed rounded-xl m-4 pointer-events-none">
            <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center animate-bounce">
                <UploadCloud className="w-10 h-10 text-indigo-600 mb-2" />
                <p className="font-bold text-indigo-600">释放鼠标上传图片 (支持多选)</p>
            </div>
        </div>
      )}

      {/* Outfit Generation Loading Overlay */}
      {isGeneratingOutfit && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
             <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800">正在施展魔法...</h3>
                <p className="text-slate-500">AI 正在根据你的身材和选择的衣物生成上身效果</p>
             </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">我的衣橱</h2>
          <p className="text-slate-500 text-sm">已收录 {wardrobe.length} 件衣物</p>
        </div>
        <div className="flex gap-2">
            {selectedIds.size > 0 && (
                <button 
                    onClick={handleCreateOutfit}
                    disabled={isGeneratingOutfit}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-md animate-in fade-in"
                >
                    <Wand2 className="w-4 h-4" />
                    生成搭配 ({selectedIds.size})
                </button>
            )}
            <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isGeneratingOutfit}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 shadow-md"
            >
            <Plus className="w-4 h-4" />
            添加衣物
            </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          multiple 
          onChange={handleFileUpload}
        />
      </div>

      {/* Upload Queue Section */}
      {uploadQueue.length > 0 && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {uploadQueue.map(task => (
                  <div key={task.id} className={`bg-white p-3 rounded-lg border shadow-sm flex items-center gap-3 animate-in slide-in-from-top-2 ${task.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                      <div className="w-12 h-12 rounded bg-slate-100 flex-shrink-0 overflow-hidden relative group">
                          <img src={task.preview} alt="uploading" className="w-full h-full object-cover" />
                          {task.status === 'error' && (
                              <button onClick={() => removeTask(task.id)} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                                  <X className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{task.file.name}</p>
                          <p className={`text-xs flex items-center gap-1 ${task.status === 'error' ? 'text-red-600 font-bold' : task.status === 'complete' ? 'text-green-600' : task.status === 'pending' ? 'text-slate-400' : 'text-indigo-600'}`}>
                              {task.status === 'complete' && <CheckCircle2 className="w-3 h-3" />}
                              {task.status === 'error' && <AlertCircle className="w-3 h-3" />}
                              {(task.status === 'processing_image' || task.status === 'analyzing') && <Loader2 className="w-3 h-3 animate-spin" />}
                              {getStatusText(task)}
                          </p>
                      </div>
                      {task.status === 'error' && (
                          <button onClick={() => retryTask(task.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="重试">
                              <RefreshCw className="w-4 h-4" />
                          </button>
                      )}
                  </div>
              ))}
          </div>
      )}

      {wardrobe.length === 0 && uploadQueue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-4 bg-slate-50/50">
            <Shirt className="w-16 h-16 mb-4 opacity-20" />
            <p>衣橱空空如也。</p>
            <p className="text-sm mt-1 opacity-70">点击上方按钮或直接拖入多张图片上传</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-20 p-1">
          {wardrobe.map(item => {
            const isSelected = selectedIds.has(item.id);
            return (
                <div 
                    key={item.id} 
                    onClick={() => toggleSelection(item.id)}
                    className={`group relative bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition flex flex-col cursor-pointer ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-100'}`}
                >
                <div className="aspect-square p-4 flex items-center justify-center bg-gray-50 relative">
                    <img src={item.imageUrl} alt={item.description} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 shadow-sm border border-slate-100">
                        {item.fit}
                    </div>
                    {/* Checkbox indicator */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border flex items-center justify-center transition ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-semibold text-slate-800 text-sm truncate mb-1">{item.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.description}</p>
                </div>
                
                {/* Action Buttons - Prevent clicking row */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition duration-200" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                        }}
                        className="p-1.5 bg-white/90 backdrop-blur rounded-full text-indigo-600 hover:bg-indigo-50 shadow-sm border border-slate-100"
                        title="编辑"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={(e) => deleteItem(e, item.id)}
                        className="p-1.5 bg-white/90 backdrop-blur rounded-full text-red-500 hover:bg-red-50 shadow-sm border border-slate-100"
                        title="删除"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">编辑衣物信息</h3>
                    <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={saveEdit} className="p-6 space-y-4">
                    <div className="flex justify-center mb-4">
                        <img src={editingItem.imageUrl} className="h-32 w-32 object-contain bg-slate-50 rounded-lg border border-slate-100" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">名称</label>
                        <input 
                            type="text" 
                            required
                            value={editingItem.name}
                            onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">版型</label>
                        <select 
                            value={editingItem.fit}
                            onChange={e => setEditingItem({...editingItem, fit: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="宽松">宽松</option>
                            <option value="适中">适中</option>
                            <option value="修身">修身</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">描述</label>
                        <textarea 
                            value={editingItem.description}
                            onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                            rows={3}
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" />
                            保存修改
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};