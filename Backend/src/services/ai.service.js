const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

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

The response MUST exactly match this structure:

{
  ...
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
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      console.log("==========================");
      console.log(response.text);
      console.log("==========================");

      console.log(response.text);

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
        console.log("Waiting 3 seconds before retrying...");
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
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.setContent(htmlContent, {
    waitUntil: "networkidle0",
  });

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

  await browser.close();

  return pdfBuffer;
}

// ==============================
// Resume PDF Schema
// ==============================

const resumePdfSchema = z.object({
  html: z
    .string()
    .describe(
      "Complete HTML document that can be converted directly into a professional PDF resume.",
    ),
});

// ==============================
// Generate Resume PDF
// ==============================

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
  const prompt = `
You are an expert technical recruiter and professional resume writer.

Create an ATS-friendly resume.

Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}

IMPORTANT:

technicalQuestions MUST be an array of objects.

Each object must contain:
- question
- intention
- answer

Example:

"technicalQuestions": [
  {
    "question": "Explain async/await.",
    "intention": "Tests asynchronous programming.",
    "answer": "Discuss Promises, await, and error handling."
  }
]

behavioralQuestions MUST be an array of objects.

Each object must contain:
- question
- intention
- answer

skillGaps MUST be an array of objects.

Each object must contain:
- skill
- severity

severity can ONLY be:
- low
- medium
- high

preparationPlan MUST be an array of objects.

Each object must contain:
- day
- focus
- tasks

tasks MUST be an array of strings.

Do NOT return arrays of strings.

Return ONLY valid JSON.
`;

  console.log("Prompt length:", prompt.length);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: 'Return this JSON: {"hello":"world"}',
    config: {
      responseMimeType: "application/json",
    },
  });

  const json = JSON.parse(response.text);

  const pdfBuffer = await generatePdfFromHtml(json.html);

  return pdfBuffer;
}

// ==============================
// Exports
// ==============================

module.exports = {
  generateInterviewReport,
  generateResumePdf,
};
