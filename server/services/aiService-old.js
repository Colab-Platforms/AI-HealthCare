const axios = require("axios");
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const extractMetricsFromReport = (reportText) => {
  const metrics = {};
  const deficiencies = [];
  const extractValue = (patterns, defaultUnit = "") => {
    if (!Array.isArray(patterns)) patterns = [patterns];
    for (const pattern of patterns) {
      const match = reportText.match(pattern);
      if (match) return { value: parseFloat(match[1]) || match[1], unit: match[2] || defaultUnit };
    }
    return null;
  };
  const hb = extractValue([/hemoglobin[:\s]+(\d+\.?\d*)\s*(g\/dL|g\/dl)?/i], "g/dL");
  if (hb) {
    const value = parseFloat(hb.value);
    metrics.hemoglobin = { value, unit: hb.unit, status: value < 12 ? "low" : "normal", normalRange: "12-16 g/dL" };
    if (value < 12) deficiencies.push({ name: "Low Hemoglobin", severity: "moderate", currentValue: value + " g/dL", normalRange: "12-16 g/dL", symptoms: ["Fatigue"], causes: ["Iron deficiency"], recommendations: ["Eat iron-rich foods"] });
  }
  const glucose = extractValue([/glucose[:\s]+(\d+\.?\d*)\s*(mg\/dl)?/i], "mg/dL");
  if (glucose) {
    const value = parseFloat(glucose.value);
    metrics.glucose = { value, unit: glucose.unit, status: value < 100 ? "normal" : "high", normalRange: "70-100 mg/dL" };
    if (value >= 126) deficiencies.push({ name: "High Blood Sugar", severity: "high", currentValue: value + " mg/dL", normalRange: "70-100 mg/dL", symptoms: ["Thirst"], causes: ["Diabetes"], recommendations: ["Reduce sugar"] });
  }
  return { metrics, deficiencies };
};

const generateAnalysisFromText = (reportText) => {
  const { metrics, deficiencies } = extractMetricsFromReport(reportText);
  let healthScore = 95;
  if (deficiencies.length > 0) healthScore = Math.max(60, 95 - (deficiencies.length * 8));
  healthScore = Math.max(51, Math.min(100, healthScore));
  const summaryText = deficiencies.length === 0 ? "Great news! All indicators are normal." : "Your report shows " + deficiencies.length + " areas needing attention.";
  return {
    summary: summaryText,
    summaryHindi: summaryText,
    keyFindings: Object.keys(metrics).map(key => key + ": " + metrics[key].value + " " + metrics[key].unit),
    riskFactors: deficiencies.map(d => d.name),
    healthScore: healthScore,
    metrics: metrics,
    deficiencies: deficiencies,
    recommendations: { lifestyle: ["Exercise regularly", "Eat balanced diet"], diet: "Consult nutritionist", supplements: deficiencies.map(d => ({ name: d.name, recommendations: d.recommendations })), tests: ["Follow-up in 3 months"] },
    overallTrend: deficiencies.length === 0 ? "Excellent" : "Fair",
    language: "en"
  };
};

exports.analyzeHealthReport = async (reportText, userProfile) => {
  try {
    const response = await axios.post(OPENROUTER_API_URL, { model: "google/gemini-2.0-flash-exp:free", messages: [{ role: "system", content: "Analyze health reports and return JSON." }, { role: "user", content: "Analyze: " + reportText.substring(0, 3000) }], temperature: 0.7, max_tokens: 2000 }, { headers: { "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:5000", "X-Title": "HealthAI" }, timeout: 30000 });
    const content = response.data.choices[0].message.content;
    let jsonStr = content.trim();
    if (jsonStr.includes("```json")) jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return generateAnalysisFromText(reportText);
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return generateAnalysisFromText(reportText);
  }
};

exports.generateAnalysisFromText = generateAnalysisFromText;

exports.compareReports = async (currentReport, previousReport, userProfile) => {
  return { overallTrend: "improved", summary: "Comparison completed", improvements: [], concerns: [] };
};

exports.chatWithReport = async (reportContext, userMessage, chatHistory) => {
  return { response: "I can help you with health questions." };
};
