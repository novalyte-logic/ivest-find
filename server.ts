import crypto from "crypto";
import express, { NextFunction, Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import nodemailer, { Transporter } from "nodemailer";

dotenv.config({ path: [".env.local", ".env"] });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || "0.0.0.0";
  const ACCESS_COOKIE_NAME = "novalyte_access";
  const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
  const accessCode = process.env.ACCESS_CODE?.trim() || "";
  const accessSessionSecret =
    process.env.ACCESS_SESSION_SECRET?.trim() || accessCode;

  let resendClient: Resend | null = null;
  let smtpClient: Transporter | null = null;

  const isAccessConfigured = () => Boolean(accessCode && accessSessionSecret);

  const createAccessToken = () =>
    crypto
      .createHmac("sha256", accessSessionSecret)
      .update(`novalyte-access:${accessCode}`)
      .digest("hex");

  const parseCookies = (cookieHeader?: string) => {
    if (!cookieHeader) return {} as Record<string, string>;

    return cookieHeader.split(";").reduce<Record<string, string>>((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) return cookies;

      const key = entry.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
  };

  const hasValidAccess = (req: Request) => {
    if (!isAccessConfigured()) return false;

    const cookies = parseCookies(req.headers.cookie);
    const currentToken = cookies[ACCESS_COOKIE_NAME];
    if (!currentToken) return false;

    const expectedToken = createAccessToken();
    const currentBuffer = Buffer.from(currentToken);
    const expectedBuffer = Buffer.from(expectedToken);

    if (currentBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(currentBuffer, expectedBuffer);
  };

  const setAccessCookie = (res: Response) => {
    const secure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `${ACCESS_COOKIE_NAME}=${createAccessToken()}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`,
    ];

    if (secure) {
      cookieParts.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));
  };

  const clearAccessCookie = (res: Response) => {
    const secure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `${ACCESS_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
    ];

    if (secure) {
      cookieParts.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));
  };

  const requireAccess = (req: Request, res: Response, next: NextFunction) => {
    if (hasValidAccess(req)) {
      return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
  };

  const hasSmtpConfig = () =>
    Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

  const getSmtp = () => {
    if (!smtpClient) {
      if (!hasSmtpConfig()) {
        throw new Error("SMTP is not fully configured.");
      }

      const port = Number(process.env.SMTP_PORT || 465);
      const secure =
        process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === "true"
          : port === 465;

      smtpClient = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    return smtpClient;
  };

  const getResend = () => {
    if (!resendClient) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured in environment variables.");
      }
      resendClient = new Resend(apiKey);
    }
    return resendClient;
  };

  app.use(express.json());

  // API routes
  app.get("/api/access/status", (req, res) => {
    res.json({ authenticated: hasValidAccess(req) });
  });

  app.post("/api/access/unlock", (req, res) => {
    if (!isAccessConfigured()) {
      return res.status(503).json({ error: "Access code is not configured on the server." });
    }

    const submittedCode =
      typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!submittedCode || submittedCode !== accessCode) {
      return res.status(401).json({ error: "Incorrect access code." });
    }

    setAccessCookie(res);
    return res.json({ authenticated: true });
  });

  app.post("/api/access/logout", (_req, res) => {
    clearAccessCookie(res);
    return res.json({ success: true });
  });

  app.post("/api/send-email", requireAccess, async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (hasSmtpConfig()) {
        const smtp = getSmtp();
        const fromAddress =
          process.env.SMTP_FROM_EMAIL ||
          process.env.SMTP_USER ||
          process.env.RESEND_FROM_EMAIL ||
          "onboarding@resend.dev";
        const replyToAddress =
          process.env.SMTP_REPLY_TO ||
          process.env.SMTP_FROM_EMAIL ||
          process.env.SMTP_USER ||
          undefined;

        const data = await smtp.sendMail({
          from: fromAddress,
          to,
          subject,
          html: body,
          replyTo: replyToAddress,
        });

        return res.json({ success: true, provider: "smtp", data });
      }

      const resend = getResend();
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: [to],
        subject: subject,
        html: body,
        replyTo: "jamil@novalyte.io",
      });

      if (error) {
        console.error("Resend error:", JSON.stringify(error, null, 2));
        const errorMessage = typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : JSON.stringify(error);
        return res.status(400).json({ error: errorMessage });
      }

      res.json({ success: true, provider: "resend", data });
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    console.log(`Server running on http://${displayHost}:${PORT}`);
  });
}

startServer();
