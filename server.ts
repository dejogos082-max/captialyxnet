import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";

// Initialize Firebase Admin (Backend only)
try {
  const adminObj: any = (admin as any).default || admin;
  const apps = typeof adminObj.getApps === "function" ? adminObj.getApps() : (adminObj.apps || []);
  if (!apps.length) {
    let credential: any = null;
    const certFn = adminObj.cert || (adminObj.credential && adminObj.credential.cert);

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT === "string"
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
          : process.env.FIREBASE_SERVICE_ACCOUNT;
        if (certFn) credential = certFn(sa);
      } catch (err) {
        console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT json:", err);
      }
    }

    if (!credential && fs.existsSync("./serviceAccountKey.json")) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));
        if (certFn) credential = certFn(serviceAccount);
      } catch (err) {
        console.warn("Could not read serviceAccountKey.json:", err);
      }
    }

    if (credential) {
      adminObj.initializeApp({
        credential,
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://ths-construtora-default-rtdb.firebaseio.com"
      });
      console.log("Firebase Admin SDK initialized successfully (Backend)");
    } else {
      console.warn("No Firebase Admin credentials found in env or serviceAccountKey.json");
    }
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

// Lazy Gemini SDK initialization
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10mb" }));

  // === API ROUTES (ALL SECRETS STAY ON SERVER) ===

  // 1. Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Servidor operacional com segredos protegidos no backend!" });
  });

  // 2. Storage Upload Proxy (MyCloud)
  app.post("/api/storage/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const apiKey = process.env.MYCLOUD_API_KEY;
      const bucketId = process.env.MYCLOUD_BUCKET_ID || "ff8983b2-b94b-4b5e-8e49-0653905ee563";
      const baseUrl = process.env.MYCLOUD_BASE_URL || "https://streamx.frontmk.online";

      if (!apiKey) {
        return res.status(500).json({ error: "MYCLOUD_API_KEY não configurada no servidor (.env)" });
      }

      const blob = new Blob([file.buffer], { type: file.mimetype });
      const formData = new FormData();
      formData.append("file", blob, file.originalname);

      const upstream = await fetch(`${baseUrl}/api/storage/v1/buckets/${bucketId}/objects`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey
        },
        body: formData
      });

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (error: any) {
      console.error("Erro no proxy de upload MyCloud:", error);
      return res.status(500).json({ error: error.message || "Erro no upload" });
    }
  });

  // 3. Storage Objects List Proxy (MyCloud)
  app.get("/api/storage/objects", async (req, res) => {
    try {
      const apiKey = process.env.MYCLOUD_API_KEY;
      const bucketId = process.env.MYCLOUD_BUCKET_ID || "ff8983b2-b94b-4b5e-8e49-0653905ee563";
      const baseUrl = process.env.MYCLOUD_BASE_URL || "https://streamx.frontmk.online";

      if (!apiKey) {
        return res.status(500).json({ error: "MYCLOUD_API_KEY não configurada no servidor (.env)" });
      }

      const upstream = await fetch(`${baseUrl}/api/storage/v1/buckets/${bucketId}/objects`, {
        headers: {
          "X-API-Key": apiKey
        }
      });

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (error: any) {
      console.error("Erro ao listar objetos MyCloud:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 4. Storage Delete Object Proxy (MyCloud)
  app.delete("/api/storage/objects/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const apiKey = process.env.MYCLOUD_API_KEY;
      const bucketId = process.env.MYCLOUD_BUCKET_ID || "ff8983b2-b94b-4b5e-8e49-0653905ee563";
      const baseUrl = process.env.MYCLOUD_BASE_URL || "https://streamx.frontmk.online";

      if (!apiKey) {
        return res.status(500).json({ error: "MYCLOUD_API_KEY não configurada no servidor (.env)" });
      }

      const upstream = await fetch(`${baseUrl}/api/storage/v1/buckets/${bucketId}/objects/${fileId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": apiKey
        }
      });

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (error: any) {
      console.error("Erro ao deletar objeto MyCloud:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 5. Gemini AI Financial Insights Route
  app.post("/api/ai/insights", async (req, res) => {
    try {
      const { transactions, goals } = req.body || {};
      const ai = getAI();

      if (!ai) {
        return res.json({
          summary: "Configuração de IA pendente no servidor.",
          savingsTip: "Adicione GEMINI_API_KEY nas variáveis de ambiente (.env) do servidor.",
          alert: "Chave Ausente",
          prediction: "Indisponível",
          cashFlowTip: "Sistema de IA aguardando chave no backend.",
          suggestedGoals: []
        });
      }

      if ((!transactions || transactions.length === 0) && (!goals || goals.length === 0)) {
        return res.json({
          summary: "Sem dados suficientes para análise.",
          savingsTip: "Adicione transações para receber dicas personalizadas.",
          alert: null,
          prediction: "Aguardando dados...",
          cashFlowTip: "Adicione receitas e despesas para ver dicas de fluxo.",
          suggestedGoals: []
        });
      }

      const sortedTransactions = [...(transactions || [])].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const simpleTransactions = sortedTransactions.slice(0, 50).map((t: any) => ({
        d: t.date,
        v: t.amount,
        t: t.type,
        c: t.category,
        desc: t.description
      }));

      const simpleGoals = (goals || []).map((g: any) => ({
        title: g.title,
        curr: g.currentAmount,
        target: g.targetAmount,
        dl: g.deadline,
        done: g.isCompleted
      }));

      const prompt = `Você é o 'Capitalyx AI', um consultor financeiro de elite.
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
6. "suggestedGoals": Array com 2 metas sugeridas realistas (title, targetAmount, deadline).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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

      const text = response.text || "{}";
      let parsed;
      try {
        let clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.replace(/^```json/, "").replace(/```$/, "");
        else if (clean.startsWith("```")) clean = clean.replace(/^```/, "").replace(/```$/, "");
        parsed = JSON.parse(clean.trim());
      } catch {
        parsed = {
          summary: text,
          savingsTip: "Analise seus gastos e priorize despesas essenciais.",
          alert: null,
          prediction: "Estável",
          cashFlowTip: "Mantenha o registro de entradas e saídas em dia.",
          suggestedGoals: []
        };
      }

      return res.json({
        ...parsed,
        analyzedAt: Date.now()
      });
    } catch (error: any) {
      console.error("Erro na geração de insights com Gemini no servidor:", error);
      return res.status(500).json({
        summary: "Não foi possível processar a análise inteligente no momento.",
        savingsTip: "Verifique a chave GEMINI_API_KEY no servidor.",
        alert: "Erro no Servidor",
        prediction: "Indisponível temporariamente",
        cashFlowTip: "Mantenha o controle manual de lançamentos.",
        suggestedGoals: []
      });
    }
  });

  // Vite middleware for development or static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer();
