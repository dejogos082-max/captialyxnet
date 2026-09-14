import React, { useState } from 'react';
import { Transaction, AIAnalysisResult, FinancialGoal } from '../types';
import { generateFinancialInsights } from '../services/geminiService';
import { markAIUsage, auth } from '../services/firebase';
import { Bot, Sparkles, AlertTriangle, PiggyBank, TrendingUp, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIInsightsProps {
  transactions: Transaction[];
  goals?: FinancialGoal[];
}

const AIInsights: React.FC<AIInsightsProps> = ({ transactions, goals = [] }) => {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<AIAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await generateFinancialInsights(transactions, goals);
      setInsight(result);
      
      // Mark achievement action
      if (auth.currentUser) {
        markAIUsage(auth.currentUser.uid).catch(console.error);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-8 rounded-3xl border border-indigo-500/30 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
        <div className="relative z-10">
          <div className="inline-flex p-3 bg-indigo-500/20 rounded-2xl mb-4 backdrop-blur-sm border border-indigo-500/30">
            <Sparkles className="text-indigo-400" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Capitalyx AI Intelligence</h2>
          <p className="text-indigo-200 mb-8 max-w-lg mx-auto">
            Utilize nossa inteligência artificial para analisar seus padrões de gastos, prever seu fluxo de caixa e encontrar oportunidades de economia.
          </p>
          
          {!insight && !loading && (
            <button
              onClick={handleAnalyze}
              className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              <Bot size={20} />
              Gerar Análise Financeira
            </button>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center text-indigo-300 gap-3">
              <Loader2 className="animate-spin" size={32} />
              <span className="text-sm font-medium animate-pulse">Analisando suas transações e metas...</span>
            </div>
          )}
        </div>
        
        {/* Background decorative elements */}
        <div className="absolute top-1/2 left-10 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-10 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
      </div>

      {insight && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Summary Card */}
          <div className="col-span-1 md:col-span-2 bg-surface p-6 rounded-2xl border border-slate-700 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Bot className="text-primary" size={20} />
              Resumo Inteligente
            </h3>
            <p className="text-slate-300 text-lg leading-relaxed">{insight.summary}</p>
          </div>

          {/* Savings Tip */}
          <div className="bg-emerald-900/10 p-6 rounded-2xl border border-emerald-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <PiggyBank size={80} className="text-emerald-500" />
             </div>
            <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <PiggyBank size={20} />
              Dica de Economia
            </h3>
            <p className="text-emerald-100/80">{insight.savingsTip}</p>
          </div>

          {/* Prediction */}
          <div className="bg-blue-900/10 p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp size={80} className="text-blue-500" />
             </div>
            <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <TrendingUp size={20} />
              Previsão de Caixa
            </h3>
            <p className="text-blue-100/80">{insight.prediction}</p>
          </div>

          {/* Alert (Conditional) */}
          {insight.alert && (
            <div className="col-span-1 md:col-span-2 bg-rose-900/10 p-6 rounded-2xl border border-rose-500/20 flex items-start gap-4">
              <div className="p-2 bg-rose-500/20 rounded-full shrink-0">
                <AlertTriangle className="text-rose-500" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-rose-400 mb-1">Atenção Necessária</h3>
                <p className="text-rose-200/80">{insight.alert}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AIInsights;