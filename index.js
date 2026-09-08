console.log("Starting backend server...");

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import PptxGenJS from 'pptxgenjs';
import open from 'open';
import path from 'path';

// Load variables from .env
dotenv.config();

const app = express();
app.use(cors()); // Allow external requests
app.use(express.json()); // Allow server to read JSON bodies

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

// Connect to external services
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

async function saveLog(log) {
  const { error } = await supabase.from('chat_logs').insert([log]);
  if (error) console.error('Supabase logging unavailable:', error.message);
}

function cleanAiResponse(text = '') {
  return text
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Route 1: Chat with Gemini AI
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Answer in clear, natural book-style English. Do not use markdown symbols, headings, bullets, numbered lists, asterisks, hashtags, or code formatting. Use short paragraphs and ordinary sentences. User request: ${prompt}`,
    });

    const aiMessage = cleanAiResponse(response.text);

    // Logging should never hold up the response delivered to the user.
    void saveLog({ user_prompt: prompt, ai_response: aiMessage, action_type: 'chat' });

    res.json({ reply: aiMessage });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to process chat prompt' });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let fullMessage = '';
  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.6-flash',
      contents: `Answer in clear, natural book-style English. Do not use markdown symbols, headings, bullets, numbered lists, asterisks, hashtags, or code formatting. Use short paragraphs and ordinary sentences. User request: ${prompt}`,
    });

    for await (const chunk of stream) {
      const text = chunk.text || '';
      if (!text) continue;
      fullMessage += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, text: cleanAiResponse(fullMessage) })}\n\n`);
    res.end();
    void saveLog({ user_prompt: prompt, ai_response: cleanAiResponse(fullMessage), action_type: 'chat' });
  } catch (error) {
    console.error('Chat Stream Error:', error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to process chat prompt' })}\n\n`);
      res.end();
    }
  }
});

// Route 2: Send Email
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: body,
    };

    await transporter.sendMail(mailOptions);
    const logMessage = `Sent email to ${to} with subject "${subject}"`;

    // Save action log to Supabase
    await saveLog({ user_prompt: `Send email to ${to}`, ai_response: logMessage, action_type: 'email' });

    res.json({ success: true, message: logMessage });
  } catch (error) {
    console.error('Email Error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Route 3: Generate and open a presentation
app.post('/api/create-presentation', async (req, res) => {
  try {
    const { title, items } = req.body;
    const pptx = new PptxGenJS();

    const titleSlide = pptx.addSlide();
    titleSlide.addText(title || 'Daily Execution Output', {
      x: 1,
      y: 2,
      w: 8,
      h: 1.5,
      fontSize: 32,
      bold: true,
      color: '003366',
    });

    const itemsSlide = pptx.addSlide();
    itemsSlide.addText('Scheduled Deliverables', {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 24,
      bold: true,
    });

    if (Array.isArray(items)) {
      items.forEach((item, index) => {
        itemsSlide.addText(`• ${item}`, {
          x: 0.8,
          y: 1.5 + (index * 0.5),
          w: 8,
          h: 0.5,
          fontSize: 18,
        });
      });
    }

    const filePath = path.resolve('./generated_presentation.pptx');
    await pptx.writeFile({ fileName: filePath });
    if (process.platform === 'darwin') {
      await open(filePath);
    }

    await saveLog({
      user_prompt: `Generate PPT: ${title || 'Daily Execution Output'}`,
      ai_response: filePath,
      action_type: 'ppt_generation',
    });

    res.json({ success: true, filePath, message: 'PPT generated and opened successfully.' });
  } catch (error) {
    console.error('PPT Error:', error);
    res.status(500).json({ error: 'Failed to generate PPT presentation.' });
  }
});

// Route 4: Get Database Log History
app.get('/api/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('History unavailable:', error.message);
      return res.json([]);
    }
    res.json(data ?? []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// Start listening on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
