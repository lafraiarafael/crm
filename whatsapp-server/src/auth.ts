import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WHATSAPP_SERVER_SECRET;
  if (!secret) {
    res.status(500).json({ error: "WHATSAPP_SERVER_SECRET not configured." });
    return;
  }

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || token !== secret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  next();
}
