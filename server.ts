import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  let resendClient: Resend | null = null;

  const getResend = () => {
    if (!resendClient) {
      const apiKey = process.env.RESEND_API_KEY || "re_FXPLjN5d_DpDbm2nd7xyj8trMj1Q5GEoq";
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured in environment variables.");
      }
      resendClient = new Resend(apiKey);
    }
    return resendClient;
  };

  app.use(express.json());

  // API routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
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
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
          ? (error as any).message 
          : JSON.stringify(error);
        return res.status(400).json({ error: errorMessage });
      }

      res.json({ success: true, data });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
