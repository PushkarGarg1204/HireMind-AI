const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

// ==============================
// Interview Report Schema
// ==============================

const interviewReportSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the job for which the interview report is generated",
    ),

  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "A score between 0 and 100 indicating how well the candidate matches the job.",
    ),

  technicalQuestions: z.array(
    z.object({
      question: z.string().describe("Technical interview question"),

      intention: z
        .string()
        .describe("Why the interviewer is asking this question"),

      answer: z.string().describe("Ideal answer for the question"),
    }),
  ),

  behavioralQuestions: z.array(
    z.object({
      question: z.string().describe("Behavioral interview question"),

      intention: z.string().describe("Why the interviewer asks this question"),

      answer: z.string().describe("Ideal answer for the question"),
    }),
  ),

  skillGaps: z.array(
    z.object({
      skill: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),

  preparationPlan: z.array(
    z.object({
      day: z.number(),
      focus: z.string(),
      tasks: z.array(z.string()),
    }),
  ),
});

// ==============================
// Generate Interview Report
// ==============================

async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}) {
  const prompt = `
You are an expert Software Engineering interviewer.

Generate an interview report for the following candidate.

========================
Resume
========================

${resume}

========================
Self Description
========================

${selfDescription}

========================
Job Description
========================

${jobDescription}

Return ONLY valid JSON.

DO NOT return markdown.

DO NOT return explanation.

DO NOT return any extra fields.

The response MUST exactly match this structure:

{
  "title": "",
  "matchScore": 0,
  "technicalQuestions": [
    {
      "question": "",
      "intention": "",
      "answer": ""
    }
  ],
  "behavioralQuestions": [
    {
      "question": "",
      "intention": "",
      "answer": ""
    }
  ],
  "skillGaps": [
    {
      "skill": "",
      "severity": "low"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "",
      "tasks": [""]
    }
  ]
}

Rules:

1. title should be the exact job title from the Job Description.

2. matchScore should be between 0 and 100.

3. Generate EXACTLY 5 technicalQuestions.

4. Each technicalQuestions item MUST be an object:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

5. Generate EXACTLY 5 behavioralQuestions.

6. Each behavioralQuestions item MUST be an object:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

7. Generate at least 3 skillGaps.

Each skillGap MUST be:

{
  "skill": "...",
  "severity": "low"
}

Severity can only be:
- low
- medium
- high

8. Generate exactly 7 preparationPlan objects.

Each preparationPlan item MUST be:

{
  "day": 1,
  "focus": "...",
  "tasks": [
    "...",
    "...",
    "..."
  ]
}

9. Never return empty arrays.

10. Return ONLY valid JSON.
`;

  console.log("Prompt length:", prompt.length);

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Attempt ${attempt}...`);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      console.log("==========================");
      console.log(response.text);
      console.log("==========================");

      const json = JSON.parse(response.text);

      console.log("========== AI JSON ==========");
      console.log(JSON.stringify(json, null, 2));
      console.log("=============================");

      return json;
    } catch (error) {
      lastError = error;

      console.log(`Attempt ${attempt} failed.`);
      console.log(error.message);

      if (attempt < 3) {
        console.log("Waiting before retrying...");

        const delay = attempt * 3000;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ==============================
// HTML -> PDF
// ==============================

async function generatePdfFromHtml(htmlContent) {
  // IMPORTANT:
  // Vercel does not provide the Chrome binary required by
  // normal Puppeteer. @sparticuz/chromium provides a
  // Chromium binary suitable for serverless environments.

  const chromium = require("@sparticuz/chromium");
  const puppeteer = require("puppeteer-core");

  console.log("Launching Chromium with @sparticuz/chromium...");

  const executablePath = await chromium.executablePath();

  console.log("Chromium executable path:", executablePath);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    console.log("Setting HTML content...");

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    console.log("Generating PDF...");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    console.log("PDF buffer generated:", pdfBuffer.length);

    return pdfBuffer;
  } finally {
    await browser.close();

    console.log("Chromium browser closed.");
  }
}

// ==============================
// Resume PDF Schema
// ==============================

const resumePdfSchema = z.object({
  html: z
    .string()
    .describe(
      "Complete HTML document that can be converted directly into a professional PDF.",
    ),
});

// ==============================
// Generate Resume PDF
// ==============================

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
  const prompt = `
You are an expert technical recruiter and professional resume writer.

Create a modern, ATS-friendly, one-page professional resume.

========================
Resume
========================

${resume || ""}

========================
Self Description
========================

${selfDescription || ""}

========================
Job Description
========================

${jobDescription || ""}

IMPORTANT:

- Use both Resume and Self Description if available.
- If Resume is empty, generate the resume only from Self Description.
- If Self Description is empty, generate the resume only from Resume.
- Tailor the resume according to the Job Description.
- Improve wording professionally without adding false information.
- Never invent experience, projects, companies, or education.
- Omit sections with missing information.
- Generate clean, ATS-friendly HTML with embedded CSS.
- The HTML must be printable on A4 paper using Puppeteer.
- Do not use JavaScript.
- Do not use external CSS.
- Do not use images.
- Do not use icons.
- Do not use markdown.

Return ONLY valid JSON.

The JSON must have exactly this structure:

{
  "html": "<!DOCTYPE html><html>...</html>"
}

The "html" field must contain a complete HTML document including:

- <!DOCTYPE html>
- <html>
- <head>
- <style>
- <body>

The HTML should contain a professional one-page resume.

Do not return anything except the JSON object.
`;

  console.log("========== RESUME PDF ==========");
  console.log("Prompt length:", prompt.length);

  try {
    // ==============================
    // STEP 1: Call Gemini
    // ==============================

    console.log("1. Calling Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    console.log("2. Gemini response received.");

    console.log("========== RAW AI RESPONSE ==========");

    console.log(response.text);

    console.log("=====================================");

    // ==============================
    // STEP 2: Parse JSON
    // ==============================

    console.log("3. Parsing JSON...");

    const json = JSON.parse(response.text);

    console.log("4. JSON parsed successfully.");

    // ==============================
    // STEP 3: Validate HTML
    // ==============================

    console.log("HTML exists:", !!json.html);

    console.log("HTML type:", typeof json.html);

    console.log("HTML length:", json.html?.length);

    if (!json.html || typeof json.html !== "string") {
      throw new Error("Gemini did not return valid HTML in the 'html' field.");
    }

    console.log("========== HTML PREVIEW ==========");

    console.log(json.html.substring(0, 500));

    console.log("==================================");

    // ==============================
    // STEP 4: Generate PDF
    // ==============================

    console.log("5. Starting PDF generation...");

    const pdfBuffer = await generatePdfFromHtml(json.html);

    console.log("6. PDF generated successfully!");

    console.log("PDF size:", pdfBuffer.length);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty.");
    }

    console.log("========== RESUME PDF COMPLETE ==========");

    return pdfBuffer;
  } catch (error) {
    console.error("========== RESUME PDF ERROR ==========");

    console.error(error);

    console.error(error.message);

    console.error(error.stack);

    console.error("======================================");

    throw error;
  }
}

// ==============================
// Exports
// ==============================

module.exports = {
  generateInterviewReport,
  generateResumePdf,
};
