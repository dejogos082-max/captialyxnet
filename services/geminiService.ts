import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Transaction, AIAnalysisResult, FinancialGoal } from "../types";

// --- Configuration & Helpers ---

/**
 * Recupera a chave da API de forma segura, verificando múltiplos locais de injeção de variáveis de ambiente.
 * Prioriza o padrão Vite (import.meta.env).
 */
const getApiKey = (): string => {
  try {
    // 1. Vite (Padrão moderno)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
    
    // 2. Fallback seguro para process.env
    if (typeof process !== 'undefined' && typeof process.env === 'object') {
       return process.env.API_KEY || process.env.REACT_APP_API_KEY || process.env.VITE_API_KEY || '';
    }
  } catch (e) {
    console.warn("Falha ao ler variáveis de ambiente de forma segura.", e);
  }
  return '';
};

/**
 * Remove formatação Markdown (ex: ```json ... ```) que a IA pode adicionar acidentalmente,
 * garantindo que o JSON.parse funcione corretamente.
 */
const cleanJsonString = (rawString: string): string => {
  let cleaned = rawString.trim();
  // Remove blocos de código markdown no início e fim
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
  }
  return cleaned.trim();
};

// --- Main Service ---

export const generateFinancialInsights = async (
  transactions: Transaction[], 
  goals: FinancialGoal[] = []
): Promise<AIAnalysisResult> => {
  const apiKey = getApiKey();
  
  // Fail-fast se não houver chave
  if (!apiKey) {
    return {
      summary: "Configuração de IA pendente.",
      savingsTip: "API Key não encontrada no ambiente. Configure VITE_API_KEY.",
      alert: "Chave Ausente",
      prediction: "Indisponível",
      cashFlowTip: "Sistema de IA aguardando configuração.",
      suggestedGoals: []
    };
  }

  // Inicialização do SDK
  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (error) {
     console.error("Erro fatal ao iniciar Gemini SDK:", error);
     return {
        summary: "Erro interno na IA.",
        savingsTip: "Tente novamente mais tarde.",
        alert: "Erro SDK",
        prediction: "Erro",
        cashFlowTip: "Erro na inicialização da IA.",
        suggestedGoals: []
     };
  }

  // Validação de dados de entrada
  if (transactions.length === 0 && goals.length === 0) {
    return {
      summary: "Sem dados suficientes para análise.",
      savingsTip: "Adicione transações para receber dicas personalizadas.",
      alert: null,
      prediction: "Aguardando dados...",
      cashFlowTip: "Adicione receitas e despesas para ver dicas de fluxo.",
      suggestedGoals: []
    };
  }

  // Preparação otimizada dos dados (Minificação para economizar tokens)
  // Pegamos apenas as 50 transações mais recentes para manter o contexto relevante
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const simpleTransactions = sortedTransactions.slice(0, 50).map(t => ({
    d: t.date,
    v: t.amount,
    t: t.type,
    c: t.category,
    desc: t.description // Incluído para contexto semântico
  }));

  const simpleGoals = goals.map(g => ({
    title: g.title,
    curr: g.currentAmount,
    target: g.targetAmount,
    dl: g.deadline,
    done: g.isCompleted
  }));

  // Prompt Engenharia Avançada
  const prompt = `
    Você é o 'Capitalyx AI', um consultor financeiro de elite.
    Analise os dados JSON abaixo e forneça insights estratégicos em PT-BR.
    
    DADOS:
    Transações (d=data, v=valor, t=tipo, c=cat): ${JSON.stringify(simpleTransactions)}
    Metas: ${JSON.stringify(simpleGoals)}
    
    REQUISITOS DE RESPOSTA (JSON Estrito):
    1. "summary": Visão geral do momento financeiro (max 25 palavras).
    2. "savingsTip": Uma ação concreta para economizar baseada nos maiores gastos.
    3. "alert": Alerta curto se houver risco (ex: gastos > receitas) ou null se seguro.
    4. "prediction": Previsão de saldo para o fim do mês baseada na média diária.
    5. "cashFlowTip": Dica sobre liquidez e fluxo de caixa.
    6. "suggestedGoals": Array com 2 metas sugeridas realistas (title, targetAmount, deadline).
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // Schema estrito para garantir a estrutura do JSON
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                savingsTip: { type: Type.STRING },
                alert: { type: Type.STRING, nullable: true },
                prediction: { type: Type.STRING },
                cashFlowTip: { type: Type.STRING },
                suggestedGoals: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            targetAmount: { type: Type.NUMBER },
                            deadline: { type: Type.STRING }
                        },
                        required: ["title", "targetAmount", "deadline"]
                    }
                }
            },
            required: ["summary", "savingsTip", "prediction", "cashFlowTip", "suggestedGoals"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");

    // Sanitização e Parse
    const cleanText = cleanJsonString(text);
    const result = JSON.parse(cleanText) as AIAnalysisResult;
    
    // Adiciona timestamp da análise
    return {
        ...result,
        analyzedAt: Date.now()
    };

  } catch (error) {
    console.error("Capitalyx AI Analysis Error:", error);
    
    // Fallback gracioso
    return {
      summary: "Não foi possível processar a análise inteligente no momento.",
      savingsTip: "Verifique sua conexão com a internet e tente novamente.",
      alert: "Erro de Conexão",
      prediction: "Indisponível temporariamente",
      cashFlowTip: "Mantenha o controle manual enquanto reestabelecemos a conexão.",
      suggestedGoals: []
    };
  }
};
