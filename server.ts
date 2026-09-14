import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Initialize Firebase Admin
try {
  if (fs.existsSync("./serviceAccountKey.json")) {
    const admin = require("firebase-admin");
    const serviceAccount = require("./serviceAccountKey.json");
    const apps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
    if (!apps.length) {
      const certFn = admin.cert || (admin.credential && admin.credential.cert);
      admin.initializeApp({
        credential: certFn ? certFn(serviceAccount) : undefined,
        databaseURL: "https://ths-construtora-default-rtdb.firebaseio.com"
      });
      console.log("Firebase Admin SDK initialized successfully");
    }
  } else {
    console.warn("serviceAccountKey.json not found, Firebase Admin skipped.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Configuração para proxies (Cloudflare, Railway, etc)
  app.set('trust proxy', 1);

  // Middlewares
  app.use(express.json());

  // === API ROUTES ===
  // Example Healthcheck (você pode adicionar suas próprias rotas aqui futuramente)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Servidor Node.js rodando perfeitamente!" });
  });

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== "production") {
    // Modo de Desenvolvimento
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Modo de Produção (ex: na Railway)
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Resolução de erro 502 (Bad Gateway) com Cloudflare/Proxies
  // O Node.js padrão fecha conexões após 5s, mas o Cloudflare mantém por ~60s.
  // Se o Cloudflare usar uma conexão recém-fechada pelo Node, ocorre o Erro 502.
  server.keepAliveTimeout = 65000; // 65 segundos
  server.headersTimeout = 66000; // 66 segundos
}

startServer();
