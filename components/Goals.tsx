import React, { useState } from 'react';
import { FinancialGoal } from '../types';
import { Target, Bot, Plus, Trash2, CheckCircle, DollarSign, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GoalsProps {
  goals: FinancialGoal[];
  onAddGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
  onUpdateGoal: (id: string, updates: Partial<FinancialGoal>) => void;
  onDeleteGoal: (id: string) => void;
  suggestions?: { title: string; targetAmount: number; deadline: string }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const Goals: React.FC<GoalsProps> = ({ goals, onAddGoal, onUpdateGoal, onDeleteGoal, suggestions }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmountStr, setAddAmountStr] = useState('');

  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);

  const handleUpdateProgress = (goal: FinancialGoal) => {
     if(editingId === goal.id) {
         // Save (Add Money Logic)
         const valueToAdd = parseFloat(addAmountStr);
         if (!isNaN(valueToAdd) && valueToAdd > 0) {
             const newTotal = goal.currentAmount + valueToAdd;
             onUpdateGoal(goal.id, { 
                 currentAmount: newTotal,
                 isCompleted: newTotal >= goal.targetAmount
             });
         }
         setEditingId(null);
         setAddAmountStr('');
     } else {
         // Open Input mode
         setAddAmountStr('');
         setEditingId(goal.id);
     }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAddAmountStr('');
  };

  const handleAcceptSuggestion = (suggestion: any) => {
      onAddGoal({
          title: suggestion.title,
          targetAmount: suggestion.targetAmount,
          currentAmount: 0,
          deadline: suggestion.deadline,
          isAI: true,
          isCompleted: false
      });
  };

  // Helper to render goal card
  const renderGoalCard = (goal: FinancialGoal) => {
    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
    const isEditing = editingId === goal.id;

    return (
        <motion.div
            key={goal.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`p-6 rounded-2xl border relative overflow-hidden flex flex-col justify-between transition-colors duration-300 ${
                goal.isCompleted 
                ? 'bg-emerald-900/20 border-emerald-500/30' 
                : 'bg-surface border-slate-700'
            }`}
        >
             {/* Header */}
             <div className="flex justify-between items-start mb-4">
                <div className="max-w-[80%]">
                    <h3 className="font-bold text-lg text-white truncate" title={goal.title}>{goal.title}</h3>
                    {goal.isAI && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            IA
                        </span>
                    )}
                </div>
                <button 
                    onClick={() => onDeleteGoal(goal.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded transition-colors"
                    title="Remover Meta"
                >
                    <Trash2 size={18} />
                </button>
             </div>

             {/* Amounts & Progress */}
             <div className="space-y-4">
                 <div className="flex justify-between items-end">
                     <div>
                         <p className="text-xs text-slate-400 mb-1">
                            {isEditing ? 'Adicionar Valor (+)' : 'Guardado'}
                         </p>
                         {isEditing ? (
                             <div className="flex items-center gap-1">
                                <span className="text-emerald-500 font-bold">+</span>
                                <input 
                                    type="number" 
                                    value={addAmountStr}
                                    onChange={(e) => setAddAmountStr(e.target.value)}
                                    className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    autoFocus
                                    placeholder="0.00"
                                />
                             </div>
                         ) : (
                            <p className="text-2xl font-bold text-white">{formatCurrency(goal.currentAmount)}</p>
                         )}
                     </div>
                     <div className="text-right">
                         <p className="text-xs text-slate-400">Alvo</p>
                         <p className="text-sm font-semibold text-slate-300">{formatCurrency(goal.targetAmount)}</p>
                     </div>
                 </div>

                 {/* Progress Bar */}
                 <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
                     <motion.div 
                        className={`h-full ${goal.isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8 }}
                     />
                 </div>
             </div>
            
             {/* Footer / Actions */}
             <div className="mt-6 flex justify-between items-center h-9">
                 {!isEditing ? (
                     <span className="text-xs text-slate-500">
                         Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                     </span>
                 ) : (
                    <button 
                        onClick={handleCancelEdit}
                        className="text-xs text-slate-400 hover:text-white underline"
                    >
                        Cancelar
                    </button>
                 )}

                 {!goal.isCompleted && (
                     <button
                        onClick={() => handleUpdateProgress(goal)}
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 shadow-lg ${
                            isEditing 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-primary text-white hover:bg-blue-600'
                        }`}
                     >
                         {isEditing ? <CheckCircle size={14} /> : <DollarSign size={14} />}
                         {isEditing ? 'Confirmar' : 'Adicionar'}
                     </button>
                 )}
                 
                 {goal.isCompleted && (
                    <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold">
                        <Award size={16} />
                        Concluída
                    </div>
                 )}
             </div>
        </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      
      {/* AI Suggestions Section */}
      {suggestions && suggestions.length > 0 && (
          <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-indigo-300 flex items-center gap-2 mb-4">
                  <Bot size={20} />
                  Sugestões da IA para você
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestions.map((s, idx) => (
                      <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-indigo-500/20 flex justify-between items-center">
                          <div>
                              <p className="font-medium text-slate-200">{s.title}</p>
                              <p className="text-sm text-slate-400">Meta: {formatCurrency(s.targetAmount)}</p>
                              <p className="text-xs text-indigo-400 mt-1">Prazo: {new Date(s.deadline).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <button 
                            onClick={() => handleAcceptSuggestion(s)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors"
                            title="Adicionar Meta"
                          >
                              <Plus size={18} />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* ACTIVE GOALS */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Target className="text-primary" />
            Metas em Andamento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
                {activeGoals.map(renderGoalCard)}
            </AnimatePresence>
            
            {activeGoals.length === 0 && (!suggestions || suggestions.length === 0) && completedGoals.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-700 rounded-2xl">
                    <Target className="mx-auto text-slate-600 mb-2" size={48} />
                    <p className="text-slate-400">Você ainda não tem metas.</p>
                    <p className="text-sm text-slate-500">Adicione uma manualmente ou use a IA para gerar sugestões.</p>
                </div>
            )}
            
            {activeGoals.length === 0 && completedGoals.length > 0 && (
                 <div className="col-span-full py-8 text-center bg-surface border border-slate-700 rounded-2xl">
                    <p className="text-slate-400">Nenhuma meta ativa no momento. Bom trabalho nas conclusões!</p>
                </div>
            )}
        </div>
      </div>

      {/* COMPLETED GOALS */}
      {completedGoals.length > 0 && (
          <div className="pt-8 border-t border-slate-700">
             <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Award className="text-emerald-500" />
                Metas Concluídas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                 {completedGoals.map(renderGoalCard)}
            </div>
          </div>
      )}

    </div>
  );
};

export default Goals;