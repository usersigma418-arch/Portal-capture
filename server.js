import express from 'express';
import { GoogleGenAI } from '@google/genai';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limits so high-res screenshots don't trigger '413 Payload Too Large'
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
  'base64'
);

app.post('/log-payload', async (req, res) => {
  const { text, image } = req.body;

  if (!text && !image) {
    console.log("❌ Received empty payload.");
    return res.status(400).json({ error: "No usable payload data received." });
  }

  try {
    let contents = [];

    // System instruction rules to force answer selection
    const systemPrompt = "You are an academic assistant evaluating an exam question. " +
                         "Locate the core question and any multiple-choice options (A, B, C, D) provided. " +
                         "Solve the problem thoroughly, then output ONLY the direct correct answer or option letter. " +
                         "Keep your response concise.";

    if (image) {
      console.log("📸 Image payload detected. Processing visual content...");
      const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
      
      contents = [
        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
        { text: systemPrompt }
      ];
    } else {
      console.log("📝 Text payload detected. Processing text strings...");
      const extractedText = decodeURIComponent(text);
      console.log(`[Input Text]: ${extractedText}`);
      
      contents = [
        { text: `${systemPrompt}\n\nExam Content:\n${extractedText}` }
      ];
    }

    console.log("🤖 Dispatching request to Gemini API (gemini-2.5-flash)...");
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    const geminiAnswer = aiResponse.text.trim();
    console.log(`💡 Solution Generated: ${geminiAnswer}`);

    // Forwarding payload to Telegram
    console.log("📤 Relaying data to Telegram...");
    const telegramApiUrl = `https://api.telegram.com/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🎯 Solution:\n${geminiAnswer}`
      })
    });

    console.log("✅ Pipeline completed successfully.");

  } catch (error) {
    console.error("💥 Loop failure occurred:", error.message);
  }

  // Close connection cleanly with standard tracking pixel format
  res.writeHead(200, { 'Content-Type': 'image/gif' });
  res.end(TRANSPARENT_PIXEL);
});

app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});
