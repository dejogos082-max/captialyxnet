import React, { useEffect, useState } from 'react';
import { Transaction, TransactionType, AIAnalysisResult, FinancialGoal } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import ExtendedAnalytics from './ExtendedAnalytics';

interface DashboardProps {
  transactions: Transaction[];
  aiInsight: AIAnalysisResult | null;
  onGenerateAI: () => void;
  // Passing goals for the extended view
  goals?: FinancialGoal[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, aiInsight, onGenerateAI, goals = [] }) => {
  const [currentView, setCurrentView] = useState<'default' | 'extended'>('default');
  
  // Geração Automática de IA
  useEffect(() => {
    if (!aiInsight && transactions.length >= 3) {
      const timer = setTimeout(() => {
        onGenerateAI();
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [transactions.length, aiInsight, onGenerateAI]);

  const stats = React.useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (t.type === TransactionType.INCOME) {
          acc.income += t.amount;
        } else {
          acc.expense += t.amount;
        }
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }, [transactions]);

  const chartData = React.useMemo(() => {
    const dataMap: Record<string, { name: string; income: number; expense: number }> = {};
    const now = new Date();
    for(let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dataMap[key] = { name: key, income: 0, expense: 0 };
    }

    transactions.forEach(t => {
       const date = new Date(t.date);
       const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
       if (dataMap[key]) {
           if (t.type === TransactionType.INCOME) dataMap[key].income += t.amount;
           else dataMap[key].expense += t.amount;
       }
    });

    return Object.values(dataMap);
  }, [transactions]);

  // Swipe Logic
  const handleDragEnd = (event: any, info: any) => {
    // Distância necessária para trocar de tela
    const threshold = 100;
    
    // Swipe Right (Esquerda -> Direita)
    if (info.offset.x > threshold && currentView === 'default') {
        setCurrentView('extended');
    }
    // Swipe Left (Direita -> Esquerda)
    if (info.offset.x < -threshold && currentView === 'extended') {
        setCurrentView('default');
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95
    })
  };

  // 1 = sliding right (showing extended), -1 = sliding left (showing default)
  const direction = currentView === 'extended' ? 1 : -1;

  return (
    <div className="relative w-full min-h-[80vh] flex flex-col overflow-x-hidden">
      <AnimatePresence initial={false} custom={direction} mode='popLayout'>
        
        {currentView === 'default' ? (
            <motion.div
                key="default"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6 w-full pb-20" // Adicionado pb-20 para espaço extra no final
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.05}
                onDragEnd={handleDragEnd}
                style={{ touchAction: "pan-y" }} // Permite scroll vertical nativo enquanto arrasta horizontalmente
            >
                {/* DEFAULT DASHBOARD CONTENT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.03, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="bg-surface p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group cursor-pointer"
                    >
                    <div className="absolute -right-4 -top-4 bg-primary/10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform" />
                    <div className="relative z-10">
                        <p className="text-muted text-sm font-medium mb-1">Saldo Total</p>
                        <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.balance)}</h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                        <Wallet size={16} />
                        <span>Disponível</span>
                    </div>
                    </motion.div>

                    <div className="bg-surface p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                        <p className="text-muted text-sm font-medium mb-1">Receitas</p>
                        <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.income)}</h3>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <ArrowUpCircle className="text-emerald-500" size={24} />
                        </div>
                    </div>
                    </div>

                    <div className="bg-surface p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                        <p className="text-muted text-sm font-medium mb-1">Despesas</p>
                        <h3 className="text-2xl font-bold text-rose-400">{formatCurrency(stats.expense)}</h3>
                        </div>
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                        <ArrowDownCircle className="text-rose-500" size={24} />
                        </div>
                    </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-surface p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <TrendingUp className="text-primary" size={20}/>
                        Fluxo de Caixa (7 dias)
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span>Deslize para detalhes</span>
                        <ChevronRight size={14} className="animate-pulse" />
                    </div>
                    </div>
                    
                    <div className="h-[300px] w-full mb-6 relative pointer-events-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                        <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                        <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                        </AreaChart>
                    </ResponsiveContainer>
                    </div>

                    {/* AI Suggestion Box */}
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex items-start gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0">
                        <Sparkles className="text-indigo-400" size={18} />
                        </div>
                        <div className="flex-1">
                        <h4 className="text-sm font-semibold text-indigo-300 mb-1 flex justify-between items-center">
                            Sugestão Inteligente
                            {!aiInsight && transactions.length < 3 && (
                                <span className="text-xs text-slate-500 font-normal">Adicione mais dados para gerar automaticamente</span>
                            )}
                            {aiInsight?.cashFlowTip && (
                                <span className="text-xs bg-indigo-600 px-2 py-1 rounded text-white">Atualizado</span>
                            )}
                        </h4>
                        <p className="text-sm text-slate-400">
                            {aiInsight?.cashFlowTip || "A inteligência artificial está analisando seus dados para gerar dicas de fluxo de caixa..."}
                        </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        ) : (
            <motion.div
                key="extended"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full h-full pb-20"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.05}
                onDragEnd={handleDragEnd}
                style={{ touchAction: "pan-y" }}
            >
                <ExtendedAnalytics 
                    transactions={transactions} 
                    goals={goals} 
                    onBack={() => setCurrentView('default')} 
                />
            </motion.div>
        )}

      </AnimatePresence>

      {/* Page Indicators */}
      <div className="flex justify-center w-full mt-auto absolute bottom-4 left-0 pointer-events-none">
          <div className="flex gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5 shadow-xl">
              <button 
                onClick={() => setCurrentView('extended')}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${currentView === 'extended' ? 'bg-white w-4' : 'bg-slate-600'}`} 
              />
              <button 
                onClick={() => setCurrentView('default')}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${currentView === 'default' ? 'bg-white w-4' : 'bg-slate-600'}`} 
              />
          </div>
      </div>
    </div>
  );
};

export default Dashboard;