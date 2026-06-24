import express from "express";

let app: any;
let bootstrapError: any = null;

try {
  // Dynamically import to catch any syntax or initialization crashes in server.ts
  const serverModule = await import("../server.js");
  app = serverModule.default || serverModule;
} catch (e: any) {
  bootstrapError = e;
  console.error("Vercel Serverless Function Bootstrap Crash:", e);
}

const fallbackApp = express();
fallbackApp.all("*", (req: any, res: any) => {
  res.status(500).json({
    error: "Vercel Serverless Function Bootstrap Crash",
    message: bootstrapError ? (bootstrapError.message || String(bootstrapError)) : "Server initialized but app is undefined.",
    stack: bootstrapError ? (bootstrapError.stack || null) : null,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL
    }
  });
});

export default (req: any, res: any) => {
  if (app) {
    return app(req, res);
  } else {
    return fallbackApp(req, res);
  }
};
