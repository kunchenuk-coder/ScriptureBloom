export interface ScriptureRecommendation {
  verseInfo: {
    reference: string;
    text_zh: string;
    text_en: string;
  };
  reason: string;
}

export interface DriftBottleCandidate {
  id: string;
  content: string;
  mood: string;
}

const CLIENT_FALLBACK_VERSES: ScriptureRecommendation[] = [
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
  }
];

function getClientFallbackVerse(): ScriptureRecommendation {
  return CLIENT_FALLBACK_VERSES[Math.floor(Math.random() * CLIENT_FALLBACK_VERSES.length)];
}

/**
 * AI-powered moderation to check if a prayer contains any malicious intent, insult, spam, or hostile content.
 */
export async function moderatePrayer(prayerContent: string): Promise<{ isApproved: boolean; reason?: string }> {
  try {
    const res = await fetch('/api/gemini/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prayerContent }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.warn('AI Prayer Moderation request failed, defaulting to safe approval:', error);
    return { isApproved: true, reason: 'Fallback approval' };
  }
}

/**
 * Semantically matches the user's mood/reflection with candidate anonymous drift bottles from others.
 * Filters and selects the top 3 resonant/similar bottles that the user can empathize with and pray for.
 */
export async function matchDriftBottles(
  userMood: string,
  userReflection: string,
  candidateBottles: DriftBottleCandidate[]
): Promise<string[]> {
  if (!candidateBottles || candidateBottles.length === 0) return [];

  // If there are few candidate bottles, just return their IDs directly to avoid redundant API usage
  if (candidateBottles.length <= 3) {
    return candidateBottles.map(b => b.id);
  }

  try {
    const res = await fetch('/api/gemini/match-bottles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMood, userReflection, candidateBottles }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.selectedIds || candidateBottles.slice(0, 3).map(b => b.id);
  } catch (error) {
    console.warn('AI Drift Match request failed, slicing first 3 as fallback:', error);
    return candidateBottles.slice(0, 3).map(b => b.id);
  }
}

export async function getScriptureRecommendation(
  feeling: string,
  categories: string[] = ["General"]
): Promise<ScriptureRecommendation> {
  try {
    const res = await fetch('/api/gemini/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeling, categories }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.verseInfo || !data.verseInfo.reference) {
      return getClientFallbackVerse();
    }
    return data;
  } catch (error) {
    console.warn('Scripture recommendation request failed, using gentle spiritual fallback:', error);
    return getClientFallbackVerse();
  }
}

export async function getRandomScripture(category: string = "Wisdom"): Promise<ScriptureRecommendation> {
  try {
    const res = await fetch('/api/gemini/random', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.verseInfo || !data.verseInfo.reference) {
      return getClientFallbackVerse();
    }
    return data;
  } catch (error) {
    console.warn('Random scripture request failed, using gentle spiritual fallback:', error);
    return getClientFallbackVerse();
  }
}
