import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load variables from a local .env file during local testing
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the official Gemini AI client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// A 1x1 transparent tracking pixel image (Base64 format)
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
  'base64'
);

// Listen for the data payloads coming from your browser tracking pixel
app.get('/log.png', async (req, res) => {
  const encryptedData = req.query.data;

  // If no payload is present, return the pixel immediately and stop execution
  if (!encryptedData) {
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    return res.end(TRANSPARENT_PIXEL);
  }

  try {
    // Decode the URL-encoded data back into readable text
    const extractedText = decodeURIComponent(encryptedData);
    console.log("--- Extracted Screen Text ---");
    console.log(extractedText);

    // STEP 1: Send the text content to the Gemini API for academic analysis
    console.log("🤖 Forwarding payload to Gemini...");
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: `You are an academic assistant. Analyze the text provided, extract the core question or structural content, and provide a direct, concise step-by-step solution or summary of the problem:\n\n${extractedText}`,
    });

    const geminiAnswer = aiResponse.text;
    console.log(`Gemini Solution: ${geminiAnswer}`);

    // STEP 2: Construct the webhook request to push the solution directly to Telegram
    console.log("📤 Pushing notification to Telegram...");
    const telegramApiUrl = `https://api.telegram.com/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🎯 Gemini Analysis:\n${geminiAnswer}`
      })
    });

    console.log("✅ Loop completed successfully. Notification delivered.");

  } catch (error) {
    // Captures API errors, authentication issues, or network dropouts
    console.error("💥 Error processing payload:", error.message);
  }

  // STEP 3: Finally resolve the HTTP connection by sending the tracking image
  // This layout forces cloud platforms to keep the execution environment awake during Steps 1 & 2
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(TRANSPARENT_PIXEL);
});

app.listen(PORT, () => {
  console.log(`Server is running silently on port ${PORT}`);
});
