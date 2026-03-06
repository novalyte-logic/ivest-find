import { clientGemini as ai } from "./env";

export async function generateOutreachEmail(
  investorName: string,
  investorFocus: string[],
  startupDetails: string
): Promise<string> {
  if (!ai) {
    return "VITE_GEMINI_API_KEY is not configured.";
  }

  try {
    const prompt = `
      Act as a professional startup fundraiser.
      
      I need you to draft a compelling, concise cold email to an angel investor.
      
      **Investor Details:**
      - Name: ${investorName}
      - Focus Areas: ${investorFocus.join(', ')}
      
      **My Startup Details (Novalyte AI):**
      ${startupDetails}
      
      **Key Context to Include:**
      - Novalyte AI is ready.
      - Google Ads are live.
      - We are currently out of funds and need investment to scale.
      - The ask is for 10 minutes of their time to hear about Novalyte AI.
      
      **Tone:**
      - Professional but urgent.
      - Respectful of their time.
      - Highlight the traction (Google Ads live) to show we are not just an idea.
      - Tailor the opening to their specific focus areas if possible.
      
      **Output:**
      Return ONLY the email subject and body. Format it clearly.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Failed to generate email.";
  } catch (error) {
    console.error("Error generating email:", error);
    return "An error occurred while generating the email. Please try again.";
  }
}
