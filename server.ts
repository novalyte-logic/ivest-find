import crypto from "crypto";
import express, { NextFunction, Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import nodemailer, { Transporter } from "nodemailer";
import { generateFollowUpEmail } from "./src/server/follow-up-email-service";
import {
  enrichInvestorResearch,
  getInvestorIntelProviderStatus,
  searchInvestorsWithProvider,
  verifyInvestorContact,
} from "./src/server/investor-intel-service";
import {
  isContactProvider,
  isSearchProvider,
} from "./src/lib/investor-intel";
import { buildVaultPromptContext, loadVaultData } from "./src/lib/vault";

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

  const getSenderName = () =>
    process.env.MAIL_FROM_NAME ||
    process.env.SMTP_FROM_NAME ||
    process.env.RESEND_FROM_NAME ||
    "Novalyte AI";

  const formatSenderAddress = (email?: string) => {
    if (!email) return undefined;
    const trimmed = email.trim();
    if (!trimmed) return undefined;
    if (trimmed.includes("<")) return trimmed;
    return `${getSenderName()} <${trimmed}>`;
  };

  const getSmtpFromAddress = () =>
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER ||
    process.env.RESEND_FROM_EMAIL;

  const getSmtpReplyToAddress = () =>
    process.env.SMTP_REPLY_TO ||
    getSmtpFromAddress() ||
    undefined;

  const getResendFromAddress = () =>
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER;

  const getResendReplyToAddress = () =>
    process.env.RESEND_REPLY_TO ||
    process.env.SMTP_REPLY_TO ||
    getResendFromAddress() ||
    undefined;

  const hasResendConfig = () =>
    Boolean(process.env.RESEND_API_KEY && getResendFromAddress());

  const sendWithSmtp = async ({
    to,
    subject,
    body,
  }: {
    to: string;
    subject: string;
    body: string;
  }) => {
    const smtp = getSmtp();
    const data = await smtp.sendMail({
      from: formatSenderAddress(getSmtpFromAddress()),
      to,
      subject,
      html: body,
      replyTo: getSmtpReplyToAddress(),
    });

    return { success: true, provider: "smtp" as const, data };
  };

  const sendWithResend = async ({
    to,
    subject,
    body,
  }: {
    to: string;
    subject: string;
    body: string;
  }) => {
    const resend = getResend();
    const resendFromAddress = getResendFromAddress();

    if (!resendFromAddress) {
      throw new Error("A Resend sender email address is not configured.");
    }

    const { data, error } = await resend.emails.send({
      from: formatSenderAddress(resendFromAddress),
      to: [to],
      subject,
      html: body,
      replyTo: getResendReplyToAddress(),
    });

    if (error) {
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : JSON.stringify(error);
      throw new Error(errorMessage);
    }

    return { success: true, provider: "resend" as const, data };
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
    const transportPreference =
      typeof req.body?.transport === "string" ? req.body.transport : "auto";

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (transportPreference === "resend") {
        return res.json(await sendWithResend({ to, subject, body }));
      }

      if (transportPreference === "smtp") {
        return res.json(await sendWithSmtp({ to, subject, body }));
      }

      const errors: string[] = [];

      if (hasResendConfig()) {
        try {
          return res.json(await sendWithResend({ to, subject, body }));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown Resend error";
          console.error("Resend send error:", message);
          errors.push(`Resend: ${message}`);
        }
      }

      if (hasSmtpConfig()) {
        try {
          return res.json(await sendWithSmtp({ to, subject, body }));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown SMTP error";
          console.error("SMTP send error:", message);
          errors.push(`SMTP: ${message}`);
        }
      }

      if (errors.length > 0) {
        return res.status(502).json({ error: errors.join(" | ") });
      }

      throw new Error("No email provider is configured.");
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  });

  app.get("/api/investor-intel/providers", requireAccess, (_req, res) => {
    res.json(getInvestorIntelProviderStatus());
  });

  app.post("/api/investor-intel/search", requireAccess, async (req, res) => {
    try {
      const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
      const searchProvider = req.body?.searchProvider;
      const limit = typeof req.body?.limit === "number" ? req.body.limit : 8;
      const rawVault = typeof req.body?.vaultData === "object" && req.body.vaultData !== null
        ? req.body.vaultData
        : loadVaultData();

      if (!query) {
        return res.status(400).json({ error: "Search query is required." });
      }

      if (!isSearchProvider(searchProvider)) {
        return res.status(400).json({ error: "Invalid search provider." });
      }

      const result = await searchInvestorsWithProvider({
        query,
        searchProvider,
        limit,
        vaultContext: buildVaultPromptContext(rawVault as ReturnType<typeof loadVaultData>),
      });

      return res.json(result);
    } catch (error) {
      console.error("Investor search error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to search investors.",
      });
    }
  });

  app.post("/api/investor-intel/research", requireAccess, async (req, res) => {
    try {
      const investor = req.body?.investor;
      const searchProvider = req.body?.searchProvider;

      if (!investor || typeof investor !== "object") {
        return res.status(400).json({ error: "Investor payload is required." });
      }

      if (!isSearchProvider(searchProvider)) {
        return res.status(400).json({ error: "Invalid search provider." });
      }

      const result = await enrichInvestorResearch({
        investor,
        searchProvider,
      });

      return res.json(result);
    } catch (error) {
      console.error("Investor research error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to enrich investor research.",
      });
    }
  });

  app.post("/api/investor-intel/contact", requireAccess, async (req, res) => {
    try {
      const investor = req.body?.investor;
      const contactProvider = req.body?.contactProvider;

      if (!investor || typeof investor !== "object") {
        return res.status(400).json({ error: "Investor payload is required." });
      }

      if (!isContactProvider(contactProvider)) {
        return res.status(400).json({ error: "Invalid contact provider." });
      }

      const result = await verifyInvestorContact({
        investor,
        contactProvider,
      });

      return res.json(result);
    } catch (error) {
      console.error("Investor contact error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to verify investor contact.",
      });
    }
  });

  app.post("/api/ai/follow-up", requireAccess, async (req, res) => {
    try {
      const subject =
        typeof req.body?.subject === "string" ? req.body.subject : "";
      const body = typeof req.body?.body === "string" ? req.body.body : "";
      const instruction =
        typeof req.body?.instruction === "string" ? req.body.instruction : "";
      const investor =
        req.body?.investor && typeof req.body.investor === "object"
          ? req.body.investor
          : null;
      const rawVault =
        typeof req.body?.vaultData === "object" && req.body.vaultData !== null
          ? req.body.vaultData
          : loadVaultData();

      const result = await generateFollowUpEmail({
        subject,
        body,
        instruction,
        investor,
        vaultContext: buildVaultPromptContext(
          rawVault as ReturnType<typeof loadVaultData>,
        ),
      });

      return res.json({
        provider: "vertex-ai",
        ...result,
      });
    } catch (error) {
      console.error("Follow-up generation error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate follow-up email.",
      });
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
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
