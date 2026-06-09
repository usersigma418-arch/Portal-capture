import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load variables from your local .env file
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

// Listen for the image loading trigger from Device A's bookmarklet
app.get('/log.png', async (req, res) => {
  
  // STEP 1: Immediately return the 1x1 image to keep the browser happy
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(TRANSPARENT_PIXEL);

  // STEP 2: Extract the hidden query text attached to the image link
  const encryptedData = req.query.data;
  if (!encryptedData) return;

  try {
    // Decode the data back into readable text
    const extractedText = decodeURIComponent(encryptedData);
    console.log("--- Extracted Screen Text ---");
    console.log(extractedText);

    // STEP 3: Pass the text to Gemini to find the question and generate the answer
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Fast and accurate model for parsing questions
      contents: `You are an assistant reading a student's screen content during a quiz. Find the exam question or problem in the following text, solve it, and output ONLY the direct, clear answer or multiple-choice letter option (A, B, C, D). Keep it extremely short:\n\n${extractedText}`,
    });

    const geminiAnswer = aiResponse.text;
    console.log(`Gemini Solution: ${geminiAnswer}`);

    // STEP 4: Push the solution directly to your Telegram Bot (Device B)
    const telegramApiUrl = `https://api.telegram.com/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🎯 Gemini Answer:\n${geminiAnswer}`
      })
    });

    console.log("Answer pushed to Telegram successfully.");

  } catch (error) {
    console.error("Error processing payload with Gemini:", error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running silently on port ${PORT}`);
});
