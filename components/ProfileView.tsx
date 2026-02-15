import React from 'react';
import { UserProfile } from '../types';
import { Save } from 'lucide-react';

interface ProfileViewProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, setProfile }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">个人档案</h2>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">昵称</label>
            <input 
              type="text" 
              name="name" 
              value={profile.name} 
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">肤色</label>
            <select 
              name="skinTone" 
              value={profile.skinTone} 
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="Fair">白皙 (Fair)</option>
              <option value="Light">浅色 (Light)</option>
              <option value="Medium">自然色 (Medium)</option>
              <option value="Tan">小麦色 (Tan)</option>
              <option value="Deep">深色 (Deep)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">身高</label>
            <input 
              type="text" 
              name="height" 
              value={profile.height} 
              onChange={handleChange}
              placeholder="例如：165cm" 
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">体重 / 尺码</label>
            <input 
              type="text" 
              name="weight" 
              value={profile.weight} 
              onChange={handleChange}
              placeholder="例如：50kg 或 M码" 
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">身型</label>
           <select 
              name="bodyShape" 
              value={profile.bodyShape} 
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="Hourglass">沙漏型 (Hourglass)</option>
              <option value="Pear">梨型 (Pear)</option>
              <option value="Apple">苹果型 (Apple)</option>
              <option value="Rectangle">H型/直筒型 (Rectangle)</option>
              <option value="Inverted Triangle">倒三角型 (Inverted Triangle)</option>
              <option value="Athletic">运动健美型 (Athletic)</option>
            </select>
        </div>

        <div>
           <label className="block text-sm font-medium text-slate-700 mb-1">风格偏好</label>
           <textarea 
             name="stylePreferences"
             value={profile.stylePreferences}
             onChange={handleChange}
             rows={4}
             placeholder="例如：我喜欢极简风，中性色，舒适的面料。需要适合办公室和周末早午餐的穿搭。"
             className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
           />
        </div>

        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
            <Save className="w-4 h-4" />
            保存档案
          </button>
        </div>

      </div>
    </div>
  );
};