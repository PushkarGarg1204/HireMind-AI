const pdfParse = require("pdf-parse");

const {
  generateInterviewReport,
  generateResumePdf,
} = require("../services/ai.service");

const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
  console.log("\n========== REPORT GENERATION START ==========");

  try {
    console.log("[1] Controller reached");

    console.log("[2] User:", req.user?.id);
    console.log("[3] File exists:", !!req.file);

    let resumeText = "";

    // ==========================================
    // PDF PARSING
    // ==========================================

    if (req.file) {
      console.log("[4] Starting PDF parsing...");
      console.log("[4] File name:", req.file.originalname);
      console.log("[4] File size:", req.file.size);
      console.log("[4] File type:", req.file.mimetype);

      const resumeContent = await pdfParse(req.file.buffer);

      resumeText = resumeContent.text || "";

      console.log("[5] PDF parsing successful");
      console.log("[5] Resume text length:", resumeText.length);
    } else {
      console.log("[4] No resume uploaded");
    }

    // ==========================================
    // REQUEST BODY
    // ==========================================

    const { selfDescription, jobDescription } = req.body;

    console.log("[6] Self description length:", selfDescription?.length || 0);

    console.log("[7] Job description length:", jobDescription?.length || 0);

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!req.file && !selfDescription) {
      console.log("[8] Validation failed");

      return res.status(400).json({
        message: "Please upload a resume or provide a self description.",
      });
    }

    console.log("[8] Input validation passed");

    // ==========================================
    // AI REPORT GENERATION
    // ==========================================

    console.log("[9] Calling generateInterviewReport()...");

    let interViewReportByAi;

    try {
      interViewReportByAi = await generateInterviewReport({
        resume: resumeText,
        selfDescription,
        jobDescription,
      });

      console.log("[10] generateInterviewReport() completed");
    } catch (aiError) {
      console.error("[10] ❌ generateInterviewReport() FAILED");

      console.error("AI error name:", aiError.name);

      console.error("AI error message:", aiError.message);

      console.error("AI error stack:", aiError.stack);

      throw aiError;
    }

    // ==========================================
    // AI RESPONSE
    // ==========================================

    console.log("[11] AI report received");

    console.log("[11] AI report type:", typeof interViewReportByAi);

    console.log(
      "[11] AI report:",
      JSON.stringify(interViewReportByAi, null, 2),
    );

    // ==========================================
    // MONGODB
    // ==========================================

    console.log("[12] Creating interview report in MongoDB...");

    let interviewReport;

    try {
      interviewReport = await interviewReportModel.create({
        user: req.user.id,

        resume: resumeText,

        selfDescription,

        jobDescription,

        title:
          interViewReportByAi.title ||
          interViewReportByAi.positionApplied ||
          "Software Engineer",

        // Changed || to ?? so score 0 is preserved
        matchScore: interViewReportByAi.matchScore ?? 90,

        technicalQuestions: interViewReportByAi.technicalQuestions || [],

        behavioralQuestions: interViewReportByAi.behavioralQuestions || [],

        skillGaps: interViewReportByAi.skillGaps || [],

        preparationPlan: interViewReportByAi.preparationPlan || [],
      });

      console.log("[13] MongoDB report created successfully");

      console.log("[13] Report ID:", interviewReport._id);
    } catch (dbError) {
      console.error("[13] ❌ MongoDB CREATE FAILED");

      console.error("DB error name:", dbError.name);

      console.error("DB error message:", dbError.message);

      console.error("DB error stack:", dbError.stack);

      // Show Mongoose validation errors
      if (dbError.errors) {
        console.error("[13] Mongoose validation errors:");

        Object.keys(dbError.errors).forEach((field) => {
          console.error(`${field}:`, dbError.errors[field].message);
        });
      }

      throw dbError;
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    console.log("[14] Sending response to frontend");

    console.log("========== REPORT GENERATION SUCCESS ==========\n");

    return res.status(201).json({
      message: "Interview report generated successfully.",
      interviewReport,
    });
  } catch (error) {
    console.error("\n========== REPORT GENERATION FAILED ==========");

    console.error("Error name:", error.name);

    console.error("Error message:", error.message);

    console.error("Error stack:", error.stack);

    console.error("===============================================\n");

    return res.status(500).json({
      message: "Failed to generate interview report.",
      error: error.message,
    });
  }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
  try {
    const { interviewId } = req.params;

    const interviewReport = await interviewReportModel.findOne({
      _id: interviewId,
      user: req.user.id,
    });

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    return res.status(200).json({
      message: "Interview report fetched successfully.",
      interviewReport,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong.",
      error: error.message,
    });
  }
}

/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
  try {
    const interviewReports = await interviewReportModel
      .find({
        user: req.user.id,
      })
      .sort({
        createdAt: -1,
      })
      .select(
        "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan",
      );

    return res.status(200).json({
      message: "Interview reports fetched successfully.",
      interviewReports,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong.",
      error: error.message,
    });
  }
}

/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
  try {
    const { interviewReportId } = req.params;

    const interviewReport =
      await interviewReportModel.findById(interviewReportId);

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    const { resume, jobDescription, selfDescription } = interviewReport;

    const pdfBuffer = await generateResumePdf({
      resume,
      jobDescription,
      selfDescription,
    });

    console.log("Sending PDF to client...");

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
    });

    console.log("Before send");

    res.end(pdfBuffer);

    console.log("After send");

    console.log("PDF sent successfully.");
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to generate resume PDF.",
      error: error.message,
    });
  }
}

module.exports = {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
};
