import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environmental keys from your local .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI with your secret key
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// A 1x1 transparent tracking pixel image (Base64 format)
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
  'base64'
);

// This endpoint catches the image loading trick from the bookmarklet
app.get('/log.png', async (req, res) => {
  
  // STEP 1: Immediately give the browser an image so it thinks everything is normal
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(TRANSPARENT_PIXEL);

  // STEP 2: Extract the hidden text attached to the end of the image link
  const encryptedData = req.query.data;
  if (!encryptedData) return;

  try {
    // Decode the data back into readable text
    const extractedText = decodeURIComponent(encryptedData);
    console.log("--- Extracted Screen Text ---");
    console.log(extractedText);

    // STEP 3: Pass the raw text to ChatGPT to find the question and get the answer
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast, highly accurate, and cheap to run
      messages: [
        { 
          role: "system", 
          content: "You are an assistant reading a student's screen content during a quiz. Find the exam question or problem in the text, solve it, and output ONLY the direct, clear answer or letter option (A, B, C, D). Keep it extremely short." 
        },
        { 
          role: "user", 
          content: extractedText 
        }
      ],
    });

    const aiAnswer = aiResponse.choices[0].message.content;
    console.log(`ChatGPT Solution: ${aiAnswer}`);

    // STEP 4: Instantly push the answer to your Telegram Bot (Device B)
    const telegramApiUrl = `https://api.telegram.com/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🎯 Answer:\n${aiAnswer}`
      })
    });

    console.log("Answer broadcasted to Telegram successfully.");

  } catch (error) {
    console.error("Error processing text payload:", error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running silently on port ${PORT}`);
});
