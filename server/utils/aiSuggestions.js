/**
 * Generates sustainability suggestions using Google's Gemini API (free tier).
 * Requires GEMINI_API_KEY in .env — get one free at https://aistudio.google.com/apikey
 *
 * Uses Node's built-in fetch (Node 18+), so no extra dependency is needed.
 */

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function retryDelay(response, retryIndex) {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = Number(retryAfter);
  const retryAfterDate = Date.parse(retryAfter);
  const requestedDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : Number.isFinite(retryAfterDate)
      ? Math.max(0, retryAfterDate - Date.now())
      : 500 * (2 ** retryIndex);

  return Math.min(requestedDelay, 5000);
}

/**
 * @param {Object} params
 * @param {"water"|"electricity"|"waste"} params.category
 * @param {{year:number, month:number, total:number}[]} params.monthlyHistory
 * @param {number} params.forecastNextMonth
 * @param {"increasing"|"decreasing"|"stable"} params.trend
 * @param {{target:number, unit:string} | null} params.goal
 * @returns {Promise<string[]>} array of suggestion strings
 */
async function getAISuggestions({ category, monthlyHistory, forecastNextMonth, trend, goal }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return [
      "AI suggestions aren't configured yet. Add a free GEMINI_API_KEY to the server .env file (get one at https://aistudio.google.com/apikey) to enable this feature.",
    ];
  }

  const historyText = monthlyHistory.length
    ? monthlyHistory.map(m => `${m.month}/${m.year}: ${m.total}`).join(", ")
    : "no historical data yet";

  const goalText = goal
    ? `The institution's annual goal for this category is ${goal.target} ${goal.unit}.`
    : "No goal has been set for this category yet.";

  const prompt = `You are a sustainability advisor for a university/institution using a resource-tracking platform called Ecometric.

Category: ${category}
Recent monthly usage totals: ${historyText}
Forecasted usage next month: ${forecastNextMonth}
Current trend: ${trend}
${goalText}

Give exactly 3 short, specific, and practical suggestions to reduce ${category} usage at an institution, relevant to this trend and goal. Avoid generic advice — tailor it to the fact that the trend is "${trend}". Keep each suggestion to a single sentence, under 20 words.`;

  try {
    let response;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
        }),
      });

      if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === MAX_RETRIES) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay(response, attempt)));
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return ["Could not reach the AI service right now. Please try again shortly."];
    }

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (finishReason === "MAX_TOKENS") {
      console.error("Gemini response was truncated (MAX_TOKENS). Raw text:", text);
      return ["The AI response was cut off — please try again."];
    }

    if (!text) {
      console.error("Gemini API returned no text. Full response:", JSON.stringify(data));
      return ["Could not generate suggestions right now. Please try again shortly."];
    }

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(s => String(s).trim()).filter(Boolean);
      }
    } catch (parseErr) {
      console.error("Failed to parse Gemini JSON output, falling back to line-split:", text);
    }

    // Fallback in case responseSchema isn't honored for some reason
    return text
      .split("\n")
      .map(line => line.replace(/^\s*[-\d.)]+\s*/, "").trim())
      .filter(Boolean);
  } catch (error) {
    console.error("Gemini API request failed:", error.message);
    return ["Could not reach the AI service right now. Please try again shortly."];
  }
}

module.exports = { getAISuggestions };