import { Transaction, AIAnalysisResult, FinancialGoal } from "../types";

/**
 * Solicita insights financeiros para a rota segura de backend (/api/ai/insights).
 * Nenhum token, secret ou chave do Gemini é exposta no frontend.
 */
export const generateFinancialInsights = async (
  transactions: Transaction[], 
  goals: FinancialGoal[] = []
): Promise<AIAnalysisResult> => {
  try {
    const response = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transactions, goals })
    });

    if (!response.ok) {
      throw new Error(`Servidor respondeu com status ${response.status}`);
    }

    const data = await response.json();
    return {
      ...data,
      analyzedAt: data.analyzedAt || Date.now()
    };
  } catch (error: any) {
    console.error("Capitalyx AI Client Error:", error);
    return {
      summary: "Não foi possível conectar ao assistente de IA.",
      savingsTip: "Verifique sua conexão ou a configuração de GEMINI_API_KEY no servidor.",
      alert: "Serviço Indisponível",
      prediction: "Indisponível",
      cashFlowTip: "Registre suas movimentações para gerar novos relatórios.",
      suggestedGoals: []
    };
  }
};
