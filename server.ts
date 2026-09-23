import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google Gen AI client with recommended server configuration
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Curated emergency fallbacks to guarantee a seamless spiritual experience
const FALLBACK_VERSES = [
  {
    verseInfo: {
      reference: "腓立比书 4:6-7",
      text_zh: "应当一无挂虑，只要凡事借着祷告、祈求，和感谢，将你们所要的告诉神。神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。",
      text_en: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus."
    },
    reason: "在心绪起伏时，将重担交托给主，祂的平安必抚平所有纷扰。"
  },
  {
    verseInfo: {
      reference: "诗篇 23:1-3",
      text_zh: "耶和华是我的牧者，我必不至缺乏。祂使我躺卧在青草地上，领我在可歇息的水边。祂使我的灵魂苏醒，为自己的名引导我走义路。",
      text_en: "The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul."
    },
    reason: "神如同温柔的牧者，时刻看顾你的步伐，带给你最深的休憩与滋养。"
  },
  {
    verseInfo: {
      reference: "马太福音 11:28",
      text_zh: "凡劳苦担重担的人，可以到我这里来，我就使你们得安息。",
      text_en: "Come to me, all you who are weary and burdened, and I will give you rest."
    },
    reason: "不论世界多么喧嚣繁忙，主的怀抱永远是你卸下疲惫的避风港。"
  },
  {
    verseInfo: {
      reference: "以赛亚书 40:31",
      text_zh: "但那等候耶和华的，必重新得力。他们必如鹰展翅上腾，他们奔跑却不困倦，行走却不疲乏。",
      text_en: "Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint."
    },
    reason: "在静默等候中，圣灵将为你注入源源不断的新力量。"
  },
  {
    verseInfo: {
      reference: "箴言 3:5-6",
      text_zh: "你要专心仰赖耶和华，不可倚靠自己的聪明，在你一切所行的事上都要认定祂，祂必指引你的路。",
      text_en: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."
    },
    reason: "放下焦虑与执念，仰望上主的智慧，每一步都蒙祂眷顾与引领。"
  }
];

function getRandomFallbackVerse(seed?: string) {
  const index = seed 
    ? Math.abs(seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % FALLBACK_VERSES.length
    : Math.floor(Math.random() * FALLBACK_VERSES.length);
  return FALLBACK_VERSES[index];
}

// Helper to call Gemini with automatic model fallback on temporary 503 high demand
async function callGeminiWithFallback(fn: (model: string) => Promise<any>) {
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash'];
  let lastError: any = null;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Call failed on model ${model}:`, err?.message || err);
      // Wait briefly before trying next model
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw lastError;
}

// 1. Scripture recommendation endpoint
app.post('/api/gemini/recommend', async (req, res) => {
  try {
    const { feeling = '', categories = ['General'] } = req.body;
    const catText = Array.isArray(categories) ? categories.join(', ') : String(categories);
    const prompt = `Recommend a Bible verse (both Chinese and English) based on the user's current feeling/situation: "${feeling}". The categories selected are: "${catText}". Return the response in JSON format.`;

    const response = await callGeminiWithFallback(async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verseInfo: {
                type: Type.OBJECT,
                properties: {
                  reference: { type: Type.STRING },
                  text_zh: { type: Type.STRING },
                  text_en: { type: Type.STRING },
                },
                required: ['reference', 'text_zh', 'text_en'],
              },
              reason: { type: Type.STRING },
            },
            required: ['verseInfo', 'reason'],
          },
        },
      });
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('[API /api/gemini/recommend] Error:', error?.message || error);
    // Return a thoughtful fallback verse instead of failing
    const fallback = getRandomFallbackVerse(req.body?.feeling);
    return res.json(fallback);
  }
});

// 2. Random scripture endpoint
app.post('/api/gemini/random', async (req, res) => {
  try {
    const { category = 'Wisdom' } = req.body;
    const prompt = `Provide a random beautiful Bible verse (Chinese and English) from the category: "${category}". Return in JSON format.`;

    const response = await callGeminiWithFallback(async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verseInfo: {
                type: Type.OBJECT,
                properties: {
                  reference: { type: Type.STRING },
                  text_zh: { type: Type.STRING },
                  text_en: { type: Type.STRING },
                },
                required: ['reference', 'text_zh', 'text_en'],
              },
              reason: { type: Type.STRING, description: 'A short blessing or reason for this random verse' },
            },
            required: ['verseInfo', 'reason'],
          },
        },
      });
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('[API /api/gemini/random] Error:', error?.message || error);
    const fallback = getRandomFallbackVerse(req.body?.category);
    return res.json(fallback);
  }
});

// 3. AI Prayer Moderation endpoint
app.post('/api/gemini/moderate', async (req, res) => {
  try {
    const { prayerContent = '' } = req.body;
    const prompt = `You are a warm, kind spiritual moderator. Evaluate this prayer submitted by a user for another's drift bottle: "${prayerContent}". 
Determine if the prayer has any malice, hate speech, sarcasm, offensive language, trolling, or spam. 
A good prayer is supportive, kind, empathetic, blessing-filled and gentle.
Return your evaluation in JSON format.`;

    const response = await callGeminiWithFallback(async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isApproved: {
                type: Type.BOOLEAN,
                description: 'Whether the prayer is clean, warm, benign and safe to send (true) or contains malice/incurs safety concerns (false)',
              },
              reason: {
                type: Type.STRING,
                description: 'Brief reason for approval or rejection',
              },
            },
            required: ['isApproved', 'reason'],
          },
        },
      });
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('[API /api/gemini/moderate] Moderation fallback:', error?.message || error);
    return res.json({ isApproved: true, reason: 'Fallback approval' });
  }
});

// 4. Drift bottle semantic match endpoint
app.post('/api/gemini/match-bottles', async (req, res) => {
  try {
    const { userMood = '', userReflection = '', candidateBottles = [] } = req.body;
    if (!Array.isArray(candidateBottles) || candidateBottles.length === 0) {
      return res.json({ selectedIds: [] });
    }

    if (candidateBottles.length <= 3) {
      return res.json({ selectedIds: candidateBottles.map((b: any) => b.id) });
    }

    const prompt = `You are an empathetic spiritual helper. A user is feeling "${userMood}" with description: "${userReflection}".
Review this list of anonymous drift bottles containing the feelings/journal writeups of other users, and select up to 3 bottles that have the most similar, resonant, or complementary life experiences or emotional trials so the user can pray for them.

Candidate drift bottles:
${JSON.stringify(candidateBottles, null, 2)}

Select the ID strings of the top 3 matching bottles. Return the results in JSON format matching the schema.`;

    const response = await callGeminiWithFallback(async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selectedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'The list of up to 3 drift bottle ID strings selected for matching',
              },
            },
            required: ['selectedIds'],
          },
        },
      });
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json({ selectedIds: parsed.selectedIds || [] });
  } catch (error: any) {
    console.error('[API /api/gemini/match-bottles] Fallback:', error?.message || error);
    const candidateBottles = req.body?.candidateBottles || [];
    return res.json({ selectedIds: candidateBottles.slice(0, 3).map((b: any) => b.id) });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Setup Vite development middleware or static production serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] ScriptureBloom listening on port ${port} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
