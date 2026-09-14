import React from 'react';
import { Achievement } from '../types';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Bot, Database, Lock, Medal } from 'lucide-react';

interface AchievementsProps {
  achievements: Achievement[];
}

const getIcon = (iconName: string, isUnlocked: boolean) => {
  const className = isUnlocked ? "text-white" : "text-slate-600";
  const size = 32;

  switch (iconName) {
    case 'FirstIncome': return <TrendingUp size={size} className={className} />;
    case 'FirstExpense': return <TrendingDown size={size} className={className} />;
    case 'FirstAI': return <Bot size={size} className={className} />;
    case 'DataMaster': return <Database size={size} className={className} />;
    case 'Saver': return <Medal size={size} className={className} />;
    default: return <Trophy size={size} className={className} />;
  }
};

const Achievements: React.FC<AchievementsProps> = ({ achievements }) => {
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const progress = (unlockedCount / achievements.length) * 100;

  return (
    <div className="space-y-8">
      {/* Header with Progress */}
      <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: `${progress}%` }}
             transition={{ duration: 1, ease: "easeOut" }}
             className="h-full bg-gradient-to-r from-primary to-secondary"
           />
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
          <div>
             <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                Galeria de Conquistas
             </h2>
             <p className="text-slate-400">Desbloqueie medalhas usando o Capitalyx</p>
          </div>
          <div className="text-right">
             <span className="text-4xl font-bold text-white">{unlockedCount}</span>
             <span className="text-slate-500 text-xl">/{achievements.length}</span>
          </div>
        </div>
      </div>

      {/* Grid of Achievements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map((ach) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative p-6 rounded-2xl border transition-all duration-300 overflow-hidden group ${
              ach.isUnlocked 
                ? 'bg-surface border-slate-600 shadow-lg shadow-primary/10' 
                : 'bg-slate-900/50 border-slate-800 opacity-70 grayscale'
            }`}
          >
            {/* Background Glow for Unlocked */}
            {ach.isUnlocked && (
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500" />
            )}

            <div className="flex items-start justify-between mb-4 relative z-10">
               <div className={`p-4 rounded-xl ${
                 ach.isUnlocked 
                   ? 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-inner' 
                   : 'bg-slate-800'
               }`}>
                  {getIcon(ach.iconName, ach.isUnlocked)}
               </div>
               {!ach.isUnlocked && (
                 <Lock className="text-slate-600" size={20} />
               )}
               {ach.isUnlocked && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full border border-yellow-500/30"
                  >
                    Desbloqueado
                  </motion.div>
               )}
            </div>

            <div className="relative z-10">
              <h3 className={`text-lg font-bold mb-1 ${ach.isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                {ach.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {ach.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Achievements;