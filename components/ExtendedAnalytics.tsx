import React, { useMemo } from 'react';
import { Transaction, TransactionType, FinancialGoal } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Target, ArrowLeft } from 'lucide-react';

interface ExtendedAnalyticsProps {
  transactions: Transaction[];
  goals: FinancialGoal[];
  onBack: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
};

const ExtendedAnalytics: React.FC<ExtendedAnalyticsProps> = ({ transactions, goals, onBack }) => {

  // Process data for Cash Flow (Last 30 days)
  const cashFlowData = useMemo(() => {
    const dataMap: Record<string, { name: string; income: number; expense: number; balance: number }> = {};
    const now = new Date();
    
    // Initialize last 30 days
    for(let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dataMap[key] = { name: key, income: 0, expense: 0, balance: 0 };
    }

    transactions.forEach(t => {
       if (!t.date) return;
       
       // FIX: Parse date manually to avoid UTC timezone shifts
       // "2024-01-01" -> year=2024, month=1, day=1
       const [year, month, day] = t.date.split('-').map(Number);
       // Date constructor uses 0-indexed month (0=Jan, 11=Dec)
       const date = new Date(year, month - 1, day);
       
       const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
       
       if (dataMap[key]) {
           if (t.type === TransactionType.INCOME) dataMap[key].income += t.amount;
           else dataMap[key].expense += t.amount;
       }
    });

    return Object.values(dataMap);
  }, [transactions]);

  // Process data for Goals Completion
  const goalsData = useMemo(() => {
    return goals.filter(g => !g.isCompleted).map(g => ({
        name: g.title,
        current: g.currentAmount,
        target: g.targetAmount,
        progress: Math.min((g.currentAmount / g.targetAmount) * 100, 100)
    }));
  }, [goals]);

  return (
    <div className="space-y-6 flex flex-col pb-10">
      <div className="flex items-center gap-4 mb-2">
        <button 
            onClick={onBack}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
        >
            <ArrowLeft size={24} className="text-slate-200" />
        </button>
        <h2 className="text-2xl font-bold text-white">Análise Detalhada</h2>
      </div>

      {/* BIG CASH FLOW CHART */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface p-6 rounded-3xl border border-slate-700 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp className="text-primary" size={20}/>
            Fluxo de Caixa (30 Dias)
          </h3>
          <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
             Alta Resolução
          </span>
        </div>
        
        {/* FIX: Explicit height ensures Recharts renders correctly */}
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncomeBig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenseBig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={3} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '12px', color: '#f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                itemStyle={{ color: '#f1f5f9' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Area type="monotone" dataKey="income" name="Receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncomeBig)" />
              <Area type="monotone" dataKey="expense" name="Despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenseBig)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* GOALS COMPLETION CHART */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-surface p-6 rounded-3xl border border-slate-700 shadow-2xl flex flex-col"
      >
         <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Target className="text-indigo-400" size={20}/>
            Progresso das Metas
          </h3>
        </div>

        {goalsData.length > 0 ? (
            <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={goalsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={100} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{fill: '#334155', opacity: 0.2}}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(value: number, name: string) => {
                        if (name === 'Progresso') return [`${value.toFixed(1)}%`, name];
                        return [formatCurrency(value), name === 'target' ? 'Alvo' : 'Atual'];
                    }}
                />
                <Legend />
                <Bar dataKey="current" name="Atual" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="target" name="Alvo (Restante)" stackId="a" fill="#1e293b" radius={[0, 4, 4, 0]} barSize={20} stroke="#475569" />
                </BarChart>
            </ResponsiveContainer>
            </div>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 min-h-[200px]">
                <Target size={48} className="mb-2 opacity-50" />
                <p>Nenhuma meta ativa para analisar.</p>
            </div>
        )}
      </motion.div>
    </div>
  );
};

export default ExtendedAnalytics;