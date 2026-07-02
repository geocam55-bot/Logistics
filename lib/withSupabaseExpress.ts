import type { RequestHandler, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { createSupabaseContext, type SupabaseContext, type WithSupabaseConfig } from "@supabase/server";

function buildRequest(req: ExpressRequest): Request {
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.body === undefined || req.body === null) {
      body = undefined;
    } else if (typeof req.body === "string" || req.body instanceof Uint8Array || req.body instanceof ArrayBuffer) {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
  }

  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body,
  });
}

export function withSupabaseExpress<Database = unknown>(
  config: WithSupabaseConfig,
  handler: (req: ExpressRequest, res: ExpressResponse, ctx: SupabaseContext<Database>) => Promise<unknown>
): RequestHandler {
  return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const request = buildRequest(req);
      const result = await createSupabaseContext<Database>(request, config);

      if (result.error) {
        return res.status(result.error.status || 401).json({
          code: result.error.code,
          message: result.error.message,
        });
      }

      await handler(req, res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
