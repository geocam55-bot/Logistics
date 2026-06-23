import express from "express";

let app: any;
try {
  // Attempt to load the main server module
  const serverModule = await import("../server");
  app = serverModule.default || serverModule;
} catch (e: any) {
  console.error("Vercel Serverless Function Bootstrap Crash:", e);
  app = express();
  app.all("*", (req: any, res: any) => {
    res.status(500).json({
      error: "Vercel Serverless Function Bootstrap Crash",
      message: e.message || String(e),
      stack: e.stack || null,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL
      }
    });
  });
}

export default app;
