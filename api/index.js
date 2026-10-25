var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/utils/formatters.ts
function getPalette(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[idx];
}
function parseDuration(duration) {
  if (!duration) return 210;
  if (typeof duration === "number") return duration;
  if (typeof duration.seconds === "number") return duration.seconds;
  if (typeof duration.text === "string") {
    const parts = duration.text.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 210;
}
function getBestThumbnail(thumbnails, fallback = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80") {
  if (!thumbnails) return fallback;
  let url = "";
  if (typeof thumbnails === "object" && Array.isArray(thumbnails.contents)) {
    thumbnails = thumbnails.contents;
  }
  if (Array.isArray(thumbnails) && thumbnails.length > 0) {
    const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    url = sorted[0]?.url || "";
  } else if (typeof thumbnails === "object" && thumbnails.url) {
    url = thumbnails.url;
  } else if (typeof thumbnails === "string") {
    url = thumbnails;
  }
  if (!url) return fallback;
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.includes("googleusercontent.com") || url.includes("ggpht.com")) {
    if (url.includes("=w") || url.includes("=s")) {
      url = url.replace(/=w\d+-h\d+[^?&#]*/g, "=w544-h544-l90-rj");
      url = url.replace(/=s\d+[^?&#]*/g, "=s544-c-k-c0x00ffffff-no-rj");
    } else {
      url = `${url}=w544-h544-l90-rj`;
    }
  }
  if (url.includes("i.ytimg.com")) {
    url = url.replace(/[?&]sqp=[^&#]*/g, "").replace(/[?&]rs=[^&#]*/g, "");
    url = url.replace(/\?&/g, "?").replace(/[?&]$/, "");
    const vMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//);
    if (vMatch && vMatch[1]) {
      const vidId = vMatch[1];
      if (url.includes("/default.jpg")) {
        url = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
      }
    }
  }
  return url;
}
function getText(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val.text === "string") return val.text;
  if (Array.isArray(val.runs)) {
    return val.runs.map((r) => r.text || "").join("");
  }
  return String(val);
}
var COLOR_PALETTES;
var init_formatters = __esm({
  "server/utils/formatters.ts"() {
    COLOR_PALETTES = [
      { dominant: "#4f46e5", accent: "#ec4899" },
      { dominant: "#7c3aed", accent: "#06b6d4" },
      { dominant: "#059669", accent: "#3b82f6" },
      { dominant: "#e11d48", accent: "#fbbf24" },
      { dominant: "#d97706", accent: "#ef4444" },
      { dominant: "#0284c7", accent: "#34d399" },
      { dominant: "#8b5cf6", accent: "#f43f5e" },
      { dominant: "#0d9488", accent: "#f59e0b" },
      { dominant: "#6366f1", accent: "#10b981" }
    ];
  }
});

// server/services/geminiLyrics.ts
import { GoogleGenAI } from "@google/genai";
function getAI() {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    try {
      aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Failed to initialize GoogleGenAI:", e);
    }
  }
  return aiInstance;
}
function transliterateTamilToThanglish(text) {
  if (!text) return "";
  if (!/[\u0B80-\u0BFF]/.test(text)) {
    return text;
  }
  const wordMap = [
    [/அன்பே/g, "Anbe"],
    [/அன்பு/g, "Anbu"],
    [/கண்ணே/g, "Kanne"],
    [/கண்/g, "Kan"],
    [/காதல்/g, "Kadhal"],
    [/காதலே/g, "Kadhale"],
    [/உயிரே/g, "Uyire"],
    [/உயிர்/g, "Uyir"],
    [/வா/g, "Vaa"],
    [/போ/g, "Poo"],
    [/நீ/g, "Nee"],
    [/நான்/g, "Naan"],
    [/நானே/g, "Naane"],
    [/நீயே/g, "Neeye"],
    [/என்ன/g, "Enna"],
    [/என்னை/g, "Ennai"],
    [/உன்னை/g, "Unnai"],
    [/உன்னோடு/g, "Unnodu"],
    [/என்னோடு/g, "Ennodu"],
    [/மனசு/g, "Manasu"],
    [/மனமே/g, "Maname"],
    [/பாட்டு/g, "Paattu"],
    [/பாடல்/g, "Paadal"],
    [/மலரே/g, "Malare"],
    [/அழகு/g, "Azhagu"],
    [/அழகே/g, "Azhage"],
    [/நிலவே/g, "Nilave"],
    [/இரவு/g, "Iravu"],
    [/பகலே/g, "Pagale"],
    [/நெஞ்சே/g, "Nenje"],
    [/இதயம்/g, "Ithayam"],
    [/சொல்/g, "Sol"],
    [/சொல்லு/g, "Sollu"],
    [/கேளு/g, "Kelu"],
    [/பாரு/g, "Paaru"],
    [/சிரிப்பு/g, "Sirippu"],
    [/வாழ்க்கை/g, "Vaazhkai"],
    [/வேண்டும்/g, "Vendum"]
  ];
  let result = text;
  for (const [regex, rep] of wordMap) {
    result = result.replace(regex, rep);
  }
  const vowels = {
    "\u0B85": "a",
    "\u0B86": "aa",
    "\u0B87": "i",
    "\u0B88": "ee",
    "\u0B89": "u",
    "\u0B8A": "oo",
    "\u0B8E": "e",
    "\u0B8F": "ae",
    "\u0B90": "ai",
    "\u0B92": "o",
    "\u0B93": "oa",
    "\u0B94": "au",
    "\u0B83": "akh"
  };
  const consonants = {
    "\u0B95": "ka",
    "\u0B99": "nga",
    "\u0B9A": "cha",
    "\u0B9E": "nja",
    "\u0B9F": "ta",
    "\u0BA3": "na",
    "\u0BA4": "tha",
    "\u0BA8": "na",
    "\u0BAA": "pa",
    "\u0BAE": "ma",
    "\u0BAF": "ya",
    "\u0BB0": "ra",
    "\u0BB2": "la",
    "\u0BB5": "va",
    "\u0BB4": "zha",
    "\u0BB3": "la",
    "\u0BB1": "ra",
    "\u0BA9": "na",
    "\u0B9C": "ja",
    "\u0BB7": "sha",
    "\u0BB8": "sa",
    "\u0BB9": "ha"
  };
  const modifiers = {
    "\u0BBE": "aa",
    "\u0BBF": "i",
    "\u0BC0": "ee",
    "\u0BC1": "u",
    "\u0BC2": "oo",
    "\u0BC6": "e",
    "\u0BC7": "ae",
    "\u0BC8": "ai",
    "\u0BCA": "o",
    "\u0BCB": "oa",
    "\u0BCC": "au"
  };
  let output = "";
  const chars = Array.from(result);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];
    if (vowels[char]) {
      output += vowels[char];
    } else if (consonants[char]) {
      if (nextChar === "\u0BCD") {
        output += consonants[char].replace(/a$/, "");
        i++;
      } else if (nextChar && modifiers[nextChar]) {
        output += consonants[char].replace(/a$/, "") + modifiers[nextChar];
        i++;
      } else {
        output += consonants[char];
      }
    } else {
      output += char;
    }
  }
  return output.replace(/\s+/g, " ").trim();
}
async function convertLinesToThanglish(lines) {
  if (!lines || lines.length === 0) return [];
  const hasTamilScript = lines.some((l) => /[\u0B80-\u0BFF]/.test(l.text));
  const hasDevanagari = lines.some((l) => /[\u0900-\u097F]/.test(l.text));
  if (!hasTamilScript && !hasDevanagari) {
    return lines;
  }
  const ai = getAI();
  if (ai) {
    try {
      const rawText = lines.map((l) => l.text).join("\n");
      const prompt = `Transliterate the following Tamil/Hindi song lyrics into clean, natural THANGLISH (Roman/English script Tamil/Hindi).
Keep the EXACT line breaks and line count.
Do NOT translate to English meaning \u2014 transliterate phonetically (e.g. "\u0B85\u0BA9\u0BCD\u0BAA\u0BC7 \u0B85\u0BA9\u0BCD\u0BAA\u0BC7" -> "Anbe Anbe").

Lyrics:
${rawText}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const responseText = response.text ? response.text.trim() : "";
      if (responseText) {
        const transliteratedLines = responseText.split("\n").map((s) => s.trim());
        if (transliteratedLines.length === lines.length) {
          return lines.map((line, idx) => ({
            time: line.time,
            text: transliteratedLines[idx] || line.text
          }));
        }
      }
    } catch {
    }
  }
  return lines.map((l) => ({
    time: l.time,
    text: transliterateTamilToThanglish(l.text)
  }));
}
var aiInstance;
var init_geminiLyrics = __esm({
  "server/services/geminiLyrics.ts"() {
    aiInstance = null;
  }
});

// server/services/jioSaavnService.ts
import DES from "des.js";
function normalizeForMatch(value) {
  if (!value) return "";
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\((?:[^)]*)\)|\[[^\]]*\]/g, " ").replace(/[^\p{L}\p{N}\p{M}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}
function tokenSet(value) {
  return new Set(
    normalizeForMatch(value).split(" ").filter((token) => token.length > 0 && !STOP_WORDS.has(token))
  );
}
function tokenSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared++;
  }
  return 2 * shared / (a.size + b.size);
}
function compactName(value) {
  return normalizeForMatch(value).replace(/\s+/g, "");
}
function artistSimilarity(targetArtist, candidateArtist) {
  const base = tokenSimilarity(tokenSet(targetArtist || ""), tokenSet(candidateArtist || ""));
  const candidateCompact = compactName(candidateArtist);
  if (!candidateCompact) return base;
  const credits = (targetArtist || "").split(/[,&]|feat\.?|ft\.?/i).map((credit) => compactName(credit)).filter((credit) => credit.length >= 5);
  if (credits.some((credit) => candidateCompact.includes(credit))) {
    return Math.max(base, 0.85);
  }
  return base;
}
function scoreCandidate(candidate, target) {
  const targetTitle = tokenSet(target.title);
  const candidateTitle = tokenSet(candidate.title);
  let titleScore = tokenSimilarity(targetTitle, candidateTitle);
  if (normalizeForMatch(candidate.title) === normalizeForMatch(target.title)) {
    titleScore = Math.max(titleScore, 0.95);
  } else if (candidateTitle.size > 0 && normalizeForMatch(candidate.title).startsWith(normalizeForMatch(target.title))) {
    titleScore = Math.max(titleScore, 0.8);
  }
  const artistScore = artistSimilarity(target.artist, candidate.artist);
  let durationScore = 0.5;
  if (target.durationSec && candidate.duration > 0) {
    const delta = Math.abs(candidate.duration - target.durationSec);
    if (delta <= 3) durationScore = 1;
    else if (delta <= 6) durationScore = 0.7;
    else if (delta <= 12) durationScore = 0.35;
    else if (delta <= 25) durationScore = 0.15;
    else durationScore = 0;
  }
  return 0.62 * titleScore + 0.23 * artistScore + 0.15 * durationScore;
}
function isLabelCredit(artist) {
  if (!artist) return false;
  return /\b(music|records|studios?|entertainment|official|label|audio|tv|films?|productions?)\b/i.test(
    artist
  );
}
function pickBestMatch(candidates, target) {
  if (!target.title || candidates.length === 0) return null;
  const targetTitle = tokenSet(target.title);
  const targetArtist = tokenSet(target.artist || "");
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, target);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  if (!best) return null;
  const titleScore = tokenSimilarity(targetTitle, tokenSet(best.title));
  const artistScore = artistSimilarity(target.artist, best.artist);
  const durationDelta = target.durationSec && best.duration > 0 ? Math.abs(best.duration - target.durationSec) : null;
  const exactTitle = normalizeForMatch(best.title) === normalizeForMatch(target.title);
  const artistKnown = targetArtist.size > 0 && !isLabelCredit(target.artist);
  const artistOk = !artistKnown || artistScore >= 0.25;
  const durationOk = durationDelta === null || durationDelta <= 12 || exactTitle && (artistScore >= 0.34 || !artistKnown);
  const bestTokens = tokenSet(best.title);
  let sharedTokens = 0;
  for (const token of targetTitle) {
    if (bestTokens.has(token)) sharedTokens++;
  }
  const targetCoverage = targetTitle.size > 0 ? sharedTokens / targetTitle.size : 0;
  const titleOk = targetCoverage >= 0.7 || exactTitle || titleScore >= 0.8;
  return titleOk && durationOk && (artistOk || durationDelta !== null && durationDelta <= 4) && bestScore >= 0.5 ? best : null;
}
function buildTitleVariants(rawTitle) {
  const variants = [];
  const push = (value) => {
    const trimmed = value.replace(/^[\s|·•-]+|[\s|·•-]+$/g, "").trim();
    if (trimmed.length < 2) return;
    const key = normalizeForMatch(trimmed);
    if (!key) return;
    if (variants.some((existing) => normalizeForMatch(existing) === key)) return;
    variants.push(trimmed);
  };
  push(rawTitle);
  const withoutQualifier = rawTitle.replace(
    /\s*[([-]?\s*\b(film version|video song|full video|lyrical video|lyric video|official video|video song|video|lyrical|lyrics)\b[)\]]?\s*$/i,
    ""
  ).trim();
  if (withoutQualifier && normalizeForMatch(withoutQualifier) !== normalizeForMatch(rawTitle)) {
    push(withoutQualifier);
  }
  if (rawTitle.includes("|")) {
    rawTitle.split("|").map((segment) => segment.trim()).filter((segment) => segment.length > 1).forEach(push);
  }
  const dashed = rawTitle.split(/\s+[-–—]\s+/);
  if (dashed.length > 1) push(dashed[0]);
  return variants;
}
function buildMatchHypotheses(rawTitle, rawArtist) {
  const artist = (rawArtist || "").trim();
  const hypotheses = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (title, credit) => {
    const key = `${normalizeForMatch(title)}|${normalizeForMatch(credit || "")}`;
    if (!normalizeForMatch(title) || seen.has(key)) return;
    seen.add(key);
    hypotheses.push({ title, artist: credit || void 0 });
  };
  const singleCredit = artist && !/[,&]|feat\.?|ft\.?/i.test(artist) && artist.split(/\s+/).length <= 5;
  const swapped = Boolean(rawTitle.includes("|") && singleCredit);
  for (const variant of buildTitleVariants(rawTitle).slice(0, swapped ? 2 : 3)) {
    push(variant, artist);
  }
  if (swapped) push(artist, "");
  return hypotheses.slice(0, 3);
}
function decryptMediaUrl(encrypted, prefer320 = true) {
  if (!encrypted) return null;
  try {
    const des = DES.DES.create({ type: "decrypt", key: Buffer.from(SAAVN_DES_KEY) });
    const decrypted = Buffer.concat([
      Buffer.from(des.update(Buffer.from(encrypted, "base64"))),
      Buffer.from(des.final())
    ]).toString("utf8").trim();
    if (!/^https?:\/\//.test(decrypted)) return null;
    if (prefer320) {
      return decrypted.replace(/_\d+\.mp4(\?.*)?$/, "_320.mp4$1");
    }
    return decrypted;
  } catch {
    return null;
  }
}
function toTrack(raw) {
  const more = raw?.more_info || {};
  const encrypted = more.encrypted_media_url || "";
  const streamUrl = decryptMediaUrl(encrypted, more["320kbps"] === "true");
  if (!streamUrl) return null;
  const artists = Array.isArray(more.artistMap?.primary_artists) ? more.artistMap.primary_artists.map((a) => a?.name).filter(Boolean) : [];
  const subtitleArtists = String(raw?.subtitle || "").split(" - ")[0].split(",").map((s) => s.trim()).filter(Boolean);
  const artwork = typeof raw?.image === "string" ? raw.image.replace(/150x150|50x50/, "500x500") : void 0;
  return {
    id: String(raw?.id || ""),
    title: decodeHtmlEntities(String(raw?.title || "")),
    artist: decodeHtmlEntities(artists.join(", ") || subtitleArtists.join(", ")),
    album: decodeHtmlEntities(String(more?.album || "")),
    duration: parseInt(String(more?.duration || raw?.duration || "0"), 10) || 0,
    streamUrl320: streamUrl,
    artwork,
    language: raw?.language ? String(raw.language) : void 0,
    year: raw?.year ? String(raw.year) : void 0
  };
}
function decodeHtmlEntities(value) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function isDirectPlayableCdnUrl(url) {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === "https:" && /(^|\.)saavncdn\.com$/.test(hostname);
  } catch {
    return false;
  }
}
var SAAVN_API, SAAVN_DES_KEY, SAAVN_USER_AGENT, SEARCH_TTL_MS, MAX_CACHE_ENTRIES, REQUEST_TIMEOUT_MS, STOP_WORDS, JioSaavnService, jioSaavnService;
var init_jioSaavnService = __esm({
  "server/services/jioSaavnService.ts"() {
    SAAVN_API = "https://www.jiosaavn.com/api.php";
    SAAVN_DES_KEY = "38346591";
    SAAVN_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    SEARCH_TTL_MS = 6 * 60 * 60 * 1e3;
    MAX_CACHE_ENTRIES = 800;
    REQUEST_TIMEOUT_MS = 6e3;
    STOP_WORDS = /* @__PURE__ */ new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "of",
      "from",
      "feat",
      "ft",
      "featuring",
      "with",
      "official",
      "video",
      "audio",
      "lyric",
      "lyrics",
      "song",
      "full",
      "hd",
      "4k",
      "remaster",
      "remastered",
      "version",
      "edit",
      "explicit",
      "clean"
    ]);
    JioSaavnService = class {
      constructor() {
        this.searchCache = /* @__PURE__ */ new Map();
        this.inflightSearches = /* @__PURE__ */ new Map();
        this.trackCache = /* @__PURE__ */ new Map();
        this.albumCache = /* @__PURE__ */ new Map();
        this.inflightAlbums = /* @__PURE__ */ new Map();
      }
      isConfigured() {
        return true;
      }
      /**
       * Finds the Saavn track that corresponds to a YouTube Music track.
       * One HTTP request on a cache miss; cached for 6 hours afterwards.
       */
      async findTrack(title, artist, durationSec, album) {
        const cleanTitle = (title || "").trim();
        if (!cleanTitle) return null;
        const cacheKey = `${normalizeForMatch(cleanTitle)}|${normalizeForMatch(artist)}|${normalizeForMatch(
          album
        )}|${Math.round(durationSec || 0)}`;
        const cached = this.trackCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return cached.track;
        }
        const hypotheses = buildMatchHypotheses(cleanTitle, artist);
        const resultSets = await Promise.allSettled(
          hypotheses.map((hypothesis) => this.search(this.buildQuery(hypothesis.title, hypothesis.artist)))
        );
        let searchFailed = resultSets.some((result) => result.status === "rejected");
        const pool = /* @__PURE__ */ new Map();
        for (const result of resultSets) {
          if (result.status !== "fulfilled") continue;
          for (const track of result.value) {
            if (!pool.has(track.id)) pool.set(track.id, track);
          }
        }
        const candidates = [...pool.values()];
        let match = null;
        for (const hypothesis of hypotheses) {
          match = pickBestMatch(candidates, {
            title: hypothesis.title,
            artist: hypothesis.artist,
            durationSec
          });
          if (match) break;
        }
        if (!match && hypotheses.length > 0) {
          try {
            const bareTracks = await this.search(hypotheses[0].title);
            for (const hypothesis of hypotheses) {
              match = pickBestMatch(bareTracks, {
                title: hypothesis.title,
                artist: hypothesis.artist,
                durationSec
              });
              if (match) break;
            }
          } catch {
            searchFailed = true;
          }
        }
        let albumFailed = false;
        if (!match && album) {
          try {
            const albumTracks = await this.findAlbumTracks(album, artist);
            for (const hypothesis of hypotheses) {
              match = pickBestMatch(albumTracks, {
                title: hypothesis.title,
                artist: hypothesis.artist,
                durationSec
              });
              if (match) break;
            }
          } catch {
            albumFailed = true;
          }
        }
        if (!searchFailed && !albumFailed) {
          this.remember(this.trackCache, cacheKey, { track: match, expires: Date.now() + SEARCH_TTL_MS });
        }
        return match;
      }
      /** Returns the cached track for a Saavn song id, or null. */
      getCachedByUrl(streamUrl) {
        for (const entry of this.trackCache.values()) {
          if (entry.track?.streamUrl320 === streamUrl) return entry.track;
        }
        return null;
      }
      /**
       * Resolves an album name to its track list.
       *
       * Catalogue search ranks popular songs above album deep cuts, so a track that definitely
       * exists can be absent from the result page. Loading its album finds it by name instead.
       */
      async findAlbumTracks(albumName, artist) {
        const key = `${normalizeForMatch(albumName)}|${normalizeForMatch(artist)}`;
        const cached = this.albumCache.get(key);
        if (cached && cached.expires > Date.now()) return cached.tracks;
        const inflight = this.inflightAlbums.get(key);
        if (inflight) return inflight;
        const task = this.requestAlbumTracks(albumName).then((tracks) => {
          this.remember(this.albumCache, key, { tracks, expires: Date.now() + SEARCH_TTL_MS });
          return tracks;
        }).finally(() => {
          this.inflightAlbums.delete(key);
        });
        this.inflightAlbums.set(key, task);
        return task;
      }
      async requestAlbumTracks(albumName) {
        const search = await this.requestApi({
          __call: "search.getAlbumResults",
          q: albumName,
          p: "1",
          n: "6"
        });
        const results = Array.isArray(search?.results) ? search.results : [];
        const targetAlbum = tokenSet(albumName);
        const albums = results.filter((album) => album?.id).map((album) => ({
          id: String(album.id),
          score: tokenSimilarity(targetAlbum, tokenSet(String(album.title || "")))
        })).filter((album) => album.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, 2);
        const lists = await Promise.all(
          albums.map(async (album) => {
            try {
              const details = await this.requestApi({
                __call: "content.getAlbumDetails",
                albumid: album.id
              });
              return Array.isArray(details?.list) ? details.list : [];
            } catch {
              return [];
            }
          })
        );
        const tracks = /* @__PURE__ */ new Map();
        for (const raw of lists.flat()) {
          if (raw?.type && raw.type !== "song") continue;
          const track = toTrack(raw);
          if (track && !tracks.has(track.id)) tracks.set(track.id, track);
        }
        return [...tracks.values()];
      }
      buildQuery(title, artist) {
        if (isLabelCredit(artist)) {
          return title.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s+/g, " ").trim();
        }
        const primaryArtist = (artist || "").split(/[,&]|feat\.?|ft\.?/i)[0].replace(/\(.*?\)|\[.*?\]/g, " ").trim();
        const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s+/g, " ").trim();
        return primaryArtist ? `${cleanTitle} ${primaryArtist}` : cleanTitle;
      }
      async search(query) {
        const key = normalizeForMatch(query);
        if (!key) return [];
        const cached = this.searchCache.get(key);
        if (cached && cached.expires > Date.now()) {
          return cached.tracks;
        }
        const inflight = this.inflightSearches.get(key);
        if (inflight) return inflight;
        const task = this.requestSearch(query).then((tracks) => {
          this.remember(this.searchCache, key, { tracks, expires: Date.now() + SEARCH_TTL_MS });
          return tracks;
        }).finally(() => {
          this.inflightSearches.delete(key);
        });
        this.inflightSearches.set(key, task);
        return task;
      }
      async requestApi(params) {
        const query = new URLSearchParams({
          _format: "json",
          _marker: "0",
          api_version: "4",
          ctx: "web6dot0",
          ...params
        });
        const response = await fetch(`${SAAVN_API}?${query.toString()}`, {
          headers: {
            "User-Agent": SAAVN_USER_AGENT,
            Accept: "application/json, text/plain, */*",
            Referer: "https://www.jiosaavn.com/"
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
        if (!response.ok) {
          throw new Error(`JioSaavn ${params.__call} HTTP ${response.status}`);
        }
        return response.json();
      }
      async requestSearch(query) {
        const payload = await this.requestApi({
          __call: "search.getResults",
          q: query,
          n: "12",
          p: "1"
        });
        const results = Array.isArray(payload?.results) ? payload.results : [];
        const tracks = [];
        for (const raw of results) {
          if (raw?.type && raw.type !== "song") continue;
          const track = toTrack(raw);
          if (track) tracks.push(track);
        }
        return tracks;
      }
      remember(cache2, key, value) {
        if (cache2.size >= MAX_CACHE_ENTRIES) {
          const oldest = cache2.keys().next().value;
          if (oldest !== void 0) cache2.delete(oldest);
        }
        cache2.set(key, value);
      }
    };
    jioSaavnService = new JioSaavnService();
  }
});

// server/services/youtubeMusic.ts
import { Innertube, Parser, Log } from "youtubei.js";
function isPlayableSongEntry(song) {
  if (!song) return false;
  const title = String(song.title || "").trim();
  if (!title || title.toLowerCase() === "unknown track") return false;
  if (typeof song.duration === "number" && song.duration > 0) {
    if (song.duration < MIN_SONG_DURATION_SECONDS || song.duration > MAX_SONG_DURATION_SECONDS) {
      return false;
    }
  }
  if (/^(jukebox|music|songs|playlist|full album|mixtape|mashup|all songs|audio jukebox|video jukebox)$/i.test(title)) {
    return false;
  }
  if (/\b(music|songs|jukebox|playlist|full album|mixtape|mashup)\s*$/i.test(title)) {
    return false;
  }
  for (const pattern of COMPILATION_PATTERNS) {
    if (pattern.test(title)) {
      if (/\bjukebox\b/i.test(pattern.source) && /\bjukebox\s+(?:hero|joints)\b/i.test(title)) {
        continue;
      }
      return false;
    }
  }
  const album = String(song.album || "").trim();
  if (album) {
    for (const pattern of COMPILATION_PATTERNS) {
      if (pattern.test(album)) {
        if (/\bjukebox\b/i.test(pattern.source) && /\bjukebox\s+(?:hero|joints)\b/i.test(album)) {
          continue;
        }
        return false;
      }
    }
  }
  if (/\b(?:the\s+)?best\s+of\b/i.test(title) && !/\b(?:the\s+)?best\s+of\s+(?:me|you|us|both|my|mine|times|life|luck|it)\b/i.test(title)) {
    return false;
  }
  const artist = String(song.artist || "").trim();
  if (artist && /\b(jukebox|compilation|records\s*compilation|non[- ]?stop)\b/i.test(artist)) {
    return false;
  }
  if (/\b(music|songs|tv)\s*$/i.test(artist)) {
    return false;
  }
  return true;
}
function applyAudioQuality(stream, quality) {
  if (!stream?.streamUrl || !isDirectPlayableCdnUrl(stream.streamUrl)) return stream;
  const wantedKbps = String(quality || "").toLowerCase() === "normal" ? 160 : 320;
  const rewritten = stream.streamUrl.replace(/_\d+(\.mp4)(?=\?|$)/, `_${wantedKbps}$1`);
  if (rewritten === stream.streamUrl) return stream;
  return { ...stream, streamUrl: rewritten, bitrate: wantedKbps * 1e3 };
}
function scoreLyricsMatch(candidate, target) {
  const targetTitle = normalizeForMatch(target.title);
  const candidateTitle = normalizeForMatch(candidate.title);
  let titleScore = 0;
  if (targetTitle && candidateTitle) {
    if (candidateTitle === targetTitle) titleScore = 1;
    else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) {
      titleScore = 0.9;
    } else {
      const targetTokens = targetTitle.split(" ");
      const candidateTokens = new Set(candidateTitle.split(" "));
      const shared = targetTokens.filter((token) => candidateTokens.has(token)).length;
      titleScore = targetTokens.length ? shared / targetTokens.length : 0;
    }
  }
  const targetArtist = normalizeForMatch(target.artist).split(" ")[0];
  const candidateArtist = normalizeForMatch(candidate.artist);
  const artistScore = targetArtist && candidateArtist.includes(targetArtist) ? 1 : 0;
  let durationScore = 0.5;
  if (target.duration && candidate.duration) {
    const delta = Math.abs(candidate.duration - target.duration);
    durationScore = delta <= 6 ? 1 : delta <= 15 ? 0.5 : 0;
  }
  const score = 0.6 * titleScore + 0.15 * artistScore + 0.25 * durationScore;
  if (artistScore === 0 && durationScore === 0) return Math.min(score, 0.5);
  return score;
}
function normalizeTitleTokens(title) {
  if (!title) return [];
  return title.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").replace(/\b(official|video|audio|lyric|lyrics|full|song|remix|lofi|hd|4k|mv|remastered|version|visualizer)\b/gi, "").replace(/[^a-z0-9\s]/gi, "").trim().split(/\s+/).filter((w) => w.length > 1);
}
function cleanYouTubeTitleAndArtist(rawTitle, channelName) {
  if (!rawTitle) return { title: "Unknown Track", artist: "Various Artists" };
  let title = rawTitle.trim();
  let artist = (channelName || "Various Artists").replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").replace(/\s*Official Channel$/i, "").trim() || "Various Artists";
  let extractedAlbum;
  const fromMatch = title.match(/\((?:From|from|Movie|Film)\s+["']?([^"')]+)["']?\)/i);
  if (fromMatch && fromMatch[1]) {
    extractedAlbum = fromMatch[1].trim();
  }
  const dashParts = title.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    const candidateArtist = dashParts[0].trim();
    const candidateTitle = dashParts.slice(1).join(" - ").trim();
    if (candidateArtist.length > 0 && candidateArtist.length < 50 && !/^(official|video|watch|full\s*video|hd|4k)/i.test(candidateArtist)) {
      artist = candidateArtist;
      title = candidateTitle;
    }
  }
  title = title.replace(/\[\s*(?:Official|Full|HD|4K|Lyrics?|Audio|Video|Music\s*Video|Visualizer|Lyric\s*Video|Remastered|Topic|VEVO)\b[^\]]*\]/gi, "").replace(/\(\s*(?:Official|Full|HD|4K|Lyrics?|Audio|Video|Music\s*Video|Visualizer|Lyric\s*Video|Remastered|Audio\s*Song|Video\s*Song)\b[^)]*\)/gi, "").replace(/\b(?:Official\s*Music\s*Video|Official\s*Video|Official\s*Audio|Full\s*Video\s*Song|Full\s*Song|Lyrics?\s*Video|Video\s*Song|Audio\s*Song|Visualizer)\b/gi, "").replace(/\s+/g, " ").trim();
  const pipeParts = title.split(/\s*\|\s*/);
  if (pipeParts.length >= 2) {
    const rawSongName = pipeParts[0].replace(/\s*(?:Video\s*Song|Audio\s*Song|Video|Audio|Song|Lyrical)\b/gi, "").trim();
    if (rawSongName.length > 0) {
      for (const part of pipeParts.slice(1)) {
        if (/anirudh|rahman|yuvan|harris|pradeep|sid sriram|ilayaraja|ilaiyaraaja|shreya|santhosh|hiphop|dsp|devi sri/i.test(part)) {
          artist = part.trim();
          break;
        }
      }
      title = rawSongName;
    }
  }
  if (!title) {
    title = rawTitle.trim();
  }
  return { title, artist, extractedAlbum };
}
function isJunkOrSpamTrack(title, artist, query) {
  const normTitle = (title || "").toLowerCase();
  const normArtist = (artist || "").toLowerCase();
  const normQuery = (query || "").toLowerCase();
  const junkKeywords = [
    "ringtone",
    "status",
    "whatsapp status",
    "viral ringtone",
    "c m ringtone",
    "infinity x",
    "slowed + reverb",
    "slowed and reverb",
    "8d audio",
    "8d",
    "3d audio",
    "nightcore",
    "lofi flip",
    "bass boosted",
    "chipmunk",
    "reaction",
    "unboxing",
    "review",
    "instrumental ringtone",
    "bgm status",
    "bgm ringtone",
    "tiktok",
    "reels",
    "shorts"
  ];
  for (const kw of junkKeywords) {
    if ((normTitle.includes(kw) || normArtist.includes(kw)) && !normQuery.includes(kw)) {
      return true;
    }
  }
  return false;
}
function scoreSongRelevance(song, query) {
  const q = query.toLowerCase().trim();
  const title = song.title.toLowerCase().trim();
  const artist = (song.artist || "").toLowerCase().trim();
  const album = (song.album || "").toLowerCase().trim();
  let score = 0;
  if (song._isTopResult) {
    score += 600;
  }
  if (typeof song._originalIndex === "number") {
    score += Math.max(0, 300 - song._originalIndex * 25);
  }
  if (title === q) {
    score += 250;
  } else if (title.startsWith(q)) {
    score += 150;
  } else if (title.includes(q)) {
    score += 100;
  }
  const queryTokens = q.split(/\s+/).filter((t) => t.length > 1);
  const titleTokens = title.split(/\s+/).filter((t) => t.length > 1);
  let matchedTokens = 0;
  for (const qt of queryTokens) {
    if (titleTokens.some((tt) => tt.includes(qt) || qt.includes(tt))) {
      matchedTokens++;
    }
  }
  const tokenRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;
  score += tokenRatio * 80;
  if (queryTokens.length >= 2 && matchedTokens < queryTokens.length) {
    score -= 80;
  }
  const popularArtists = [
    "arctic monkeys",
    "ed sheeran",
    "the weeknd",
    "taylor swift",
    "dua lipa",
    "billie eilish",
    "kendrick lamar",
    "drake",
    "ariana grande",
    "bruno mars",
    "lady gaga",
    "coldplay",
    "justin bieber",
    "post malone",
    "olivia rodrigo",
    "eminem",
    "rihanna",
    "kanye west",
    "beyonce",
    "bts",
    "blackpink",
    "bad bunny",
    "a. r. rahman",
    "anirudh ravichander",
    "sid sriram",
    "yuvan shankar raja",
    "harris jayaraj",
    "hiphop tamizha",
    "s. p. balasubrahmanyam",
    "ilaiyaraaja",
    "pradeep kumar",
    "sean roldan",
    "g. v. prakash",
    "shreya ghoshal",
    "devi sri prasad",
    "santhosh narayanan",
    "thaman s",
    "vijay prakash",
    "hariharan"
  ];
  if (popularArtists.some((pa) => artist.includes(pa))) {
    score += 250;
  }
  const coverKeywords = [
    "cover",
    "tribute",
    "karaoke",
    "instrumental",
    "reverb",
    "slowed",
    "brown eyed",
    "muzzic",
    "acoustic cover",
    "remix",
    "flip",
    "edit"
  ];
  for (const kw of coverKeywords) {
    if (artist.includes(kw) && !q.includes(kw)) {
      score -= 200;
    }
  }
  if (artist && artist !== "Various Artists" && !artist.toLowerCase().includes("vevo")) {
    score += 35;
  }
  if (album && album !== "Single") {
    score += 25;
  }
  for (const qt of queryTokens) {
    if (artist.includes(qt)) score += 30;
    if (album.includes(qt)) score += 30;
  }
  if (title.length > q.length + 35) {
    score -= 40;
  }
  return score;
}
function isTitleTooSimilar(titleA, titleB) {
  if (!titleA || !titleB) return false;
  const normA = titleA.toLowerCase().trim();
  const normB = titleB.toLowerCase().trim();
  if (normA === normB) return true;
  const tokensA = normalizeTitleTokens(titleA);
  const tokensB = normalizeTitleTokens(titleB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.join(" ") === tokensB.join(" ")) return true;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of setB) {
    if (setA.has(token)) overlap++;
  }
  const simA = overlap / tokensA.length;
  const simB = overlap / tokensB.length;
  return simA >= 0.5 || simB >= 0.5;
}
function sanitizeSeeds(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const clean = value.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_HOME_SEEDS) break;
  }
  return out;
}
function pickRotatingShelves(pool, count, random = Math.random) {
  if (pool.length <= count) return [...pool];
  const indexes = pool.map((_, i) => i);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes.slice(0, count).map((i) => pool[i]);
}
function buildPersonalizedShelves(seeds) {
  const clean = sanitizeSeeds(seeds);
  if (clean.length === 0) return [];
  const shelves = [
    {
      id: "made-for-you",
      title: "Made For You",
      subtitle: `Built from ${clean.slice(0, 3).join(", ")}`,
      query: `${clean[0]} top songs`
    }
  ];
  if (clean.length > 1) {
    shelves.push({
      id: "because-you-listened",
      title: `Because you listened to ${clean[1]}`,
      subtitle: "More in the same direction",
      query: `${clean[1]} hit songs`
    });
  }
  return shelves.slice(0, MAX_PERSONALIZED_SHELVES);
}
function selectShelvesForFeed(seeds = [], random = Math.random) {
  return [
    ...buildPersonalizedShelves(seeds),
    ...ANCHOR_SHELVES,
    ...pickRotatingShelves(ROTATING_SHELVES, ROTATING_SHELVES_PER_BUILD, random)
  ];
}
var MAX_SONG_DURATION_SECONDS, MIN_SONG_DURATION_SECONDS, COMPILATION_PATTERNS, LYRICS_MATCH_THRESHOLD, PlayerInterstitialNode, InterstitialViewNode, QUICK_PICKS_QUERY_POOL, ANCHOR_SHELVES, ROTATING_SHELVES, ROTATING_SHELVES_PER_BUILD, MAX_PERSONALIZED_SHELVES, MAX_HOME_SEEDS, YouTubeMusicService, youtubeMusicService;
var init_youtubeMusic = __esm({
  "server/services/youtubeMusic.ts"() {
    init_formatters();
    init_geminiLyrics();
    init_jioSaavnService();
    Log.setLevel(Log.Level.NONE);
    MAX_SONG_DURATION_SECONDS = 510;
    MIN_SONG_DURATION_SECONDS = 30;
    COMPILATION_PATTERNS = [
      /\bjukebox\b/i,
      /\baudio\s*jukebox\b/i,
      /\bvideo\s*jukebox\b/i,
      /\bfull\s*album\b/i,
      /\bentire\s*album\b/i,
      /\bcomplete\s*album\b/i,
      /\ball\s*songs\b/i,
      /\bsongs?\s*collection\b/i,
      /\baudio\s*collection\b/i,
      /\bmegamix\b/i,
      /\bmega\s*mix\b/i,
      /\bnon[- ]?stop\b/i,
      /\bcompilation\b/i,
      /\bdiscography\b/i,
      /\bbgm\s*collection\b/i,
      /\btheme\s*collection\b/i,
      /\bsoundtrack\s*collection\b/i,
      /\bfull\s*ost\b/i,
      /\bost\s*collection\b/i,
      /\b\d+\s*(?:hours?|hrs?)\b/i,
      /\bcontinuous\s*mix\b/i,
      /\balbum\s*stream\b/i,
      /\bcomplete\s*soundtrack\b/i,
      /\ball\s*audio\s*songs\b/i,
      /\ball\s*video\s*songs\b/i,
      /\bmashup\b/i
    ];
    LYRICS_MATCH_THRESHOLD = 0.62;
    PlayerInterstitialNode = class {
      static {
        this.type = "PlayerInterstitial";
      }
      constructor(_data) {
      }
    };
    InterstitialViewNode = class {
      static {
        this.type = "InterstitialView";
      }
      constructor(_data) {
      }
    };
    try {
      Parser.addRuntimeParser("PlayerInterstitial", PlayerInterstitialNode);
      Parser.addRuntimeParser("InterstitialView", InterstitialViewNode);
    } catch {
    }
    Parser.setParserErrorHandler(() => {
    });
    QUICK_PICKS_QUERY_POOL = [
      "Latest new Tamil movie songs 2025",
      "New Tamil single tracks 2024 2025",
      "Trending Tamil viral songs",
      "Fresh Kollywood hit songs 2025",
      "Santhosh Narayanan Tamil hit songs",
      "GV Prakash Tamil hit songs",
      "Hip Hop Tamizha Tamil songs",
      "Sam CS Tamil hit songs",
      "Harris Jayaraj Tamil hit songs",
      "Anirudh latest Tamil songs",
      "New Tamil romantic melody songs",
      "Tamil mass kuthu party hits 2025",
      "Pradeep Kumar Sid Sriram Tamil hits",
      "Dhibu Ninan Thomas Tamil songs",
      "Hesham Abdul Wahab Tamil songs",
      "Sean Roldan Tamil songs",
      "Vidya Sagar Tamil hit songs"
    ];
    ANCHOR_SHELVES = [
      {
        id: "trending-tamil",
        title: "Trending in Tamil Nadu",
        subtitle: "Latest Kollywood chartbusters & viral tracks",
        query: "Latest Tamil hit songs"
      },
      {
        id: "new-releases",
        title: "New Releases",
        subtitle: "Fresh out of the studio this week",
        query: "New Tamil songs 2025 2026"
      }
    ];
    ROTATING_SHELVES = [
      {
        id: "anirudh-essentials",
        title: "Anirudh Ravichander Essentials",
        subtitle: "Mass beats and viral anthems",
        query: "Anirudh Ravichander Tamil hit songs"
      },
      {
        id: "ar-rahman-masterpieces",
        title: "A.R. Rahman Masterpieces",
        subtitle: "Evergreen Kollywood magic & classic hits",
        query: "AR Rahman Tamil evergreen hit songs"
      },
      {
        id: "tamil-melodies",
        title: "Tamil Melody & Romance",
        subtitle: "Heart-touching acoustic & love songs",
        query: "Tamil melody love romantic songs"
      },
      {
        id: "yuvan-vibes",
        title: "Yuvan Shankar Raja Vibes",
        subtitle: "U1 youth anthems & soul melodies",
        query: "Yuvan Shankar Raja Tamil songs"
      },
      {
        id: "kuthu-party",
        title: "Mass & Kuthu Beats",
        subtitle: "High energy dance & celebration songs",
        query: "Tamil mass kuthu party dance songs"
      },
      {
        id: "kollywood-classics",
        title: "90s & 2000s Kollywood Golden Era",
        subtitle: "Harris Jayaraj, Vidyasagar & Ilaiyaraaja",
        query: "Harris Jayaraj Vidyasagar 90s 2000s Tamil hit songs"
      },
      {
        id: "sid-sriram-soul",
        title: "Sid Sriram & Pradeep Kumar",
        subtitle: "Carnatic-tinted voices & soul fills",
        query: "Sid Sriram Pradeep Kumar Tamil melody songs"
      },
      {
        id: "maestro-classics",
        title: "Ilaiyaraaja & SPB Classics",
        subtitle: "The golden era of Tamil film music",
        query: "Ilaiyaraaja SPB Tamil hit songs"
      },
      {
        id: "modern-kollywood",
        title: "Modern Kollywood Rotation",
        subtitle: "Santhosh Narayanan, GV Prakash, Sam CS",
        query: "Santhosh Narayanan GV Prakash Tamil hit songs"
      },
      {
        id: "hiphop-tamil",
        title: "Tamil Hip Hop & Rap",
        subtitle: "Hip Hop Tamizha, Hiphop Tamizha Adjacent & more",
        query: "Tamil hip hop songs Hip Hop Tamizha"
      },
      {
        id: "late-night-lofi",
        title: "Late Night Tamil Lofi",
        subtitle: "Slow reverb & wind-down melodies",
        query: "Tamil lofi slow reverb melody songs"
      },
      {
        id: "romantic-duets",
        title: "Evergreen Tamil Duets",
        subtitle: "Playlists of two-voice classics",
        query: "Tamil romantic duet hit songs"
      }
    ];
    ROTATING_SHELVES_PER_BUILD = 4;
    MAX_PERSONALIZED_SHELVES = 2;
    MAX_HOME_SEEDS = 6;
    YouTubeMusicService = class {
      constructor() {
        this.yt = null;
        this.isInitializing = false;
        this.initPromise = null;
        // In-memory cache for fast repeat lookups
        this.searchCache = /* @__PURE__ */ new Map();
        this.suggestionsCache = /* @__PURE__ */ new Map();
        this.songCache = /* @__PURE__ */ new Map();
        this.albumCache = /* @__PURE__ */ new Map();
        this.artistCache = /* @__PURE__ */ new Map();
        this.playlistCache = /* @__PURE__ */ new Map();
        this.lyricsCache = /* @__PURE__ */ new Map();
        this.homeCache = /* @__PURE__ */ new Map();
        this.queueCache = /* @__PURE__ */ new Map();
        this.playableVideoMap = /* @__PURE__ */ new Map();
        this.streamCache = /* @__PURE__ */ new Map();
        this.cachedIosInnertube = null;
        this.candidateCache = /* @__PURE__ */ new Map();
      }
      async getInnertube() {
        if (this.yt) return this.yt;
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
          this.isInitializing = true;
          try {
            const client = await Innertube.create({
              retrieve_player: true
            });
            this.yt = client;
            console.log("Innertube (youtubei.js) singleton initialized successfully.");
            return client;
          } catch (err) {
            console.error("Innertube initialization error:", err.message);
            this.yt = null;
            return null;
          } finally {
            this.isInitializing = false;
          }
        })();
        return this.initPromise;
      }
      // --- Normalization Helpers ---
      normalizeSong(item) {
        const id = item.content_id || item.id || item.video_id || (typeof item.endpoint?.payload?.videoId === "string" ? item.endpoint.payload.videoId : "") || `track-${Math.random().toString(36).slice(2, 8)}`;
        const rawTitle = item.metadata?.title?.text || getText(item.title) || getText(item.name) || "Unknown Track";
        let rawAuthor = "";
        let artistId = "";
        if (Array.isArray(item.artists) && item.artists.length > 0) {
          rawAuthor = item.artists.map((a) => getText(a.name || a)).filter(Boolean).join(", ");
          artistId = item.artists[0]?.channel_id || item.artists[0]?.id || "";
        } else if (item.author) {
          rawAuthor = getText(item.author.name || item.author);
          artistId = item.author.channel_id || item.author.id || "";
        } else if (item.metadata?.image?.a11y_label) {
          rawAuthor = item.metadata.image.a11y_label.replace(/^Go to channel\s+/i, "");
        }
        const { title, artist, extractedAlbum } = cleanYouTubeTitleAndArtist(rawTitle, rawAuthor);
        let albumName = extractedAlbum || "Single";
        let albumId = `alb-${id}`;
        if (item.album) {
          const parsedAlbum = getText(item.album.name || item.album);
          if (parsedAlbum) {
            albumName = parsedAlbum;
          }
          albumId = item.album.id || albumId;
        }
        const duration = parseDuration(item.duration?.seconds || item.duration?.text || item.duration);
        const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
        let artwork = getBestThumbnail(thumbs);
        if (!artwork || artwork.includes("unsplash") || artwork.length < 10) {
          artwork = id.startsWith("track-") ? "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80" : `https://i.ytimg.com/vi/${id}/hq720.jpg`;
        }
        const colors = getPalette(id + title);
        return {
          id,
          title,
          artists: artist,
          artist,
          artistId,
          album: albumName,
          albumId,
          artwork,
          artworkUrl: artwork,
          duration,
          explicit: Boolean(item.badges?.some((b) => getText(b.label || b).toLowerCase().includes("explicit"))),
          provider: "youtube",
          providerUrl: `https://youtube.com/watch?v=${id}`,
          streamUrl: `/api/song/${id}/audio`,
          dominantColor: colors.dominant,
          accentColor: colors.accent,
          plays: item.views ? parseInt(String(item.views).replace(/[^0-9]/g, ""), 10) || void 0 : void 0
        };
      }
      normalizeAlbum(item) {
        const id = item.content_id || item.id || item.browse_id || (typeof item.endpoint?.payload?.browseId === "string" ? item.endpoint.payload.browseId : "") || `alb-${Math.random().toString(36).slice(2, 8)}`;
        const title = item.metadata?.title?.text || getText(item.title || item.name) || "Album";
        let artistName = "Various Artists";
        let artistId = "";
        if (Array.isArray(item.artists) && item.artists.length > 0) {
          artistName = item.artists.map((a) => getText(a.name || a)).join(", ");
          artistId = item.artists[0]?.channel_id || item.artists[0]?.id || "";
        } else if (item.author) {
          artistName = getText(item.author.name || item.author);
          artistId = item.author.channel_id || item.author.id || "";
        }
        const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
        let artwork = getBestThumbnail(thumbs);
        if (!artwork) {
          artwork = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80";
        }
        const colors = getPalette(id + title);
        const year = item.year ? parseInt(String(item.year).slice(0, 4), 10) || void 0 : void 0;
        return {
          id,
          title,
          artist: artistName,
          artistId,
          artwork,
          artworkUrl: artwork,
          year,
          releaseYear: year,
          trackCount: typeof item.item_count === "number" ? item.item_count : parseInt(String(item.item_count || "0"), 10) || 0,
          tracks: [],
          dominantColor: colors.dominant,
          provider: "youtube"
        };
      }
      normalizeArtist(item) {
        const id = item.content_id || item.id || item.channel_id || (typeof item.endpoint?.payload?.browseId === "string" ? item.endpoint.payload.browseId : "") || `art-${Math.random().toString(36).slice(2, 8)}`;
        const rawName = item.metadata?.title?.text || getText(item.title || item.name || item.author) || "Artist";
        const name = rawName.replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").replace(/\s*Official Channel$/i, "").trim() || "Artist";
        const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
        let artwork = getBestThumbnail(thumbs);
        if (!artwork) {
          artwork = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80";
        }
        return {
          id,
          name,
          artwork,
          avatarUrl: artwork,
          provider: "youtube",
          popularSongs: [],
          albums: [],
          singles: [],
          relatedArtists: []
        };
      }
      normalizePlaylist(item) {
        const id = item.content_id || item.id || item.playlist_id || (typeof item.endpoint?.payload?.browseId === "string" ? item.endpoint.payload.browseId : "") || `pl-${Math.random().toString(36).slice(2, 8)}`;
        const title = item.metadata?.title?.text || getText(item.title) || "Playlist";
        const description = getText(item.description) || void 0;
        const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
        let artwork = getBestThumbnail(thumbs);
        if (!artwork) {
          artwork = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80";
        }
        return {
          id,
          title,
          description,
          artwork,
          artworkUrl: artwork,
          trackCount: typeof item.item_count === "number" ? item.item_count : parseInt(String(item.item_count || "0"), 10) || 0,
          tracks: [],
          provider: "youtube"
        };
      }
      // --- Real Service Endpoints ---
      /**
       * Real Pure YouTube Search across Videos, Channels, Playlists, and Albums
       */
      async search(query, filter, forceRefresh = false) {
        const trimmed = (query || "").trim();
        if (!trimmed) {
          return { songs: [], artists: [], albums: [], playlists: [] };
        }
        const cacheKey = `${trimmed.toLowerCase()}:${filter || "all"}`;
        const cached = this.searchCache.get(cacheKey);
        if (!forceRefresh && cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        const songs = [];
        const artists = [];
        const albums = [];
        const playlists = [];
        const pushSong = (item) => {
          const song = this.normalizeSong(item);
          if (!isPlayableSongEntry(song)) return;
          song._originalIndex = songs.length;
          songs.push(song);
        };
        const pushResult = (kind, item) => {
          if (!item) return;
          if (kind === "song") pushSong(item);
          else if (kind === "album") albums.push(this.normalizeAlbum(item));
          else if (kind === "artist") artists.push(this.normalizeArtist(item));
          else playlists.push(this.normalizePlaylist(item));
        };
        const shelfKind = (shelf) => {
          const title = String(shelf?.title ?? "").toLowerCase();
          if (title.includes("song") || title.includes("video")) return "song";
          if (title.includes("album")) return "album";
          if (title.includes("artist")) return "artist";
          if (title.includes("playlist")) return "playlist";
          return null;
        };
        const itemKind = (item) => {
          const id = String(item?.id || "");
          const type = String(item?.type || "").toLowerCase();
          if (type.includes("album") || id.startsWith("MPRE")) return "album";
          if (type.includes("two") || type.includes("artist") || type.includes("playlist")) {
            if (id.startsWith("UC")) return "artist";
            return id.startsWith("MP") ? "playlist" : null;
          }
          if (id.startsWith("UC") && id.length > 20) return "artist";
          if (id.startsWith("MP") && id.length > 20) return "playlist";
          if (item?.duration || type.includes("responsive")) return "song";
          return null;
        };
        const collectMusicResults = (res, forced) => {
          for (const shelf of res?.contents || []) {
            const hint = forced || shelfKind(shelf);
            for (const item of shelf.contents || []) {
              const kind = hint || itemKind(item);
              if (kind) pushResult(kind, item);
            }
          }
        };
        const timeoutHelper = (p, ms) => Promise.race([p.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
        if (filter === "song" || filter === "songs" || filter === "video" || filter === "videos") {
          const ytmSongs = await timeoutHelper(yt.music.search(trimmed, { type: "song" }), 12e3);
          collectMusicResults(ytmSongs, "song");
        } else if (filter === "artist" || filter === "artists" || filter === "channel" || filter === "channels") {
          const ytmArtists = await timeoutHelper(yt.music.search(trimmed, { type: "artist" }), 12e3);
          collectMusicResults(ytmArtists, "artist");
        } else if (filter === "playlist" || filter === "playlists") {
          const ytmPlaylists = await timeoutHelper(yt.music.search(trimmed, { type: "playlist" }), 12e3);
          collectMusicResults(ytmPlaylists, "playlist");
        } else if (filter === "album" || filter === "albums") {
          const ytmAlbums = await timeoutHelper(yt.music.search(trimmed, { type: "album" }), 12e3);
          collectMusicResults(ytmAlbums, "album");
        } else {
          try {
            const [ytmSongs, ytmAlbums, ytmArtists, ytmPlaylists] = await Promise.all([
              timeoutHelper(yt.music.search(trimmed, { type: "song" }), 12e3),
              timeoutHelper(yt.music.search(trimmed, { type: "album" }), 12e3),
              timeoutHelper(yt.music.search(trimmed, { type: "artist" }), 12e3),
              timeoutHelper(yt.music.search(trimmed, { type: "playlist" }), 12e3)
            ]);
            collectMusicResults(ytmSongs, "song");
            collectMusicResults(ytmAlbums, "album");
            collectMusicResults(ytmArtists, "artist");
            collectMusicResults(ytmPlaylists, "playlist");
          } catch (err) {
            console.warn("YouTube Music search fallback:", err.message);
          }
        }
        const cleanSongs = songs.filter((s) => !isJunkOrSpamTrack(s.title, s.artist, trimmed));
        const songMap = /* @__PURE__ */ new Map();
        for (const song of cleanSongs) {
          const normKey = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
          if (!songMap.has(song.id) && !songMap.has(normKey)) {
            songMap.set(song.id, song);
            songMap.set(normKey, song);
          }
        }
        const uniqueSongs = Array.from(new Set(songMap.values()));
        uniqueSongs.sort((a, b) => {
          const scoreA = scoreSongRelevance(a, trimmed);
          const scoreB = scoreSongRelevance(b, trimmed);
          return scoreB - scoreA;
        });
        const uniqueArtists = Array.from(new Map(artists.map((a) => [a.id, a])).values());
        const uniqueAlbums = Array.from(new Map(albums.map((a) => [a.id, a])).values());
        const uniquePlaylists = Array.from(new Map(playlists.map((p) => [p.id, p])).values());
        const results = {
          songs: uniqueSongs,
          artists: uniqueArtists,
          albums: uniqueAlbums,
          playlists: uniquePlaylists
        };
        this.searchCache.set(cacheKey, { data: results, expires: Date.now() + 3e5 });
        return results;
      }
      /**
       * Pure YouTube Search Suggestions
       */
      async getSearchSuggestions(query) {
        const trimmed = (query || "").trim();
        if (!trimmed) return [];
        const cacheKey = trimmed.toLowerCase();
        const cached = this.suggestionsCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        try {
          const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(trimmed)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && Array.isArray(data[1])) {
              const list = data[1].filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 10);
              if (list.length > 0) {
                this.suggestionsCache.set(cacheKey, { data: list, expires: Date.now() + 6e5 });
                return list;
              }
            }
          }
        } catch {
        }
        const yt = await this.getInnertube();
        if (!yt) return [];
        try {
          const suggestions = await yt.music.getSearchSuggestions(trimmed).catch(() => null);
          if (suggestions) {
            const list = [];
            for (const sec of suggestions || []) {
              for (const item of sec.contents || []) {
                const text = item.suggestion?.text || item.title || item.query || item.text;
                if (typeof text === "string" && text.trim().length > 0) {
                  list.push(text.trim());
                }
              }
            }
            const deduplicated = Array.from(new Set(list)).slice(0, 10);
            this.suggestionsCache.set(cacheKey, { data: deduplicated, expires: Date.now() + 6e5 });
            return deduplicated;
          }
        } catch (err) {
          console.warn("Suggestions error:", err.message);
        }
        return [];
      }
      /**
       * Real Home Feed with automated YouTube Music style recommendations tailored for Tamil music
       */
      async getHome(forceRefresh = false, mood, rawSeeds = []) {
        const seeds = sanitizeSeeds(rawSeeds);
        const cacheKey = `home_${mood || "all"}_${seeds.join("|")}`;
        const cached = this.homeCache.get(cacheKey);
        if (!forceRefresh && cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        const sections = [];
        let queries = [];
        const q1 = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
        const quickPicksQueryDef = {
          id: "quick-picks",
          title: "Quick Picks",
          subtitle: "START RADIO FROM A SONG",
          query: q1,
          type: "song"
        };
        if (!mood || mood === "all") {
          queries = [quickPicksQueryDef, ...selectShelvesForFeed(seeds)].map((shelf) => ({
            ...shelf,
            type: "song"
          }));
        } else if (mood === "trending" || mood === "music") {
          queries = [
            quickPicksQueryDef,
            { id: "trending-tamil-1", title: "Top 50 Tamil Today", subtitle: "Trending chartbusters", query: "Tamil top 50 songs", type: "song" },
            { id: "trending-tamil-2", title: "Viral Kollywood Reels", subtitle: "Most popular tracks", query: "Viral Tamil songs Instagram reels", type: "song" },
            { id: "trending-tamil-3", title: "New Releases Tamil", subtitle: "Fresh off the studio", query: "New Tamil songs 2024 2025", type: "song" }
          ];
        } else if (mood === "melody" || mood === "chill") {
          queries = [
            quickPicksQueryDef,
            { id: "melody-1", title: "Tamil Pure Melodies", subtitle: "Peaceful acoustic & love tracks", query: "Tamil melody songs Sid Sriram Pradeep Kumar", type: "song" },
            { id: "melody-2", title: "Late Night Tamil Vibes", subtitle: "Soothing lo-fi and chill melodies", query: "Tamil lofi slow reverb melody songs", type: "song" },
            { id: "melody-3", title: "Evergreen Tamil Duets", subtitle: "Romantic classics", query: "Tamil romantic duet melody songs", type: "song" }
          ];
        } else if (mood === "kuthu" || mood === "energize" || mood === "workout") {
          queries = [
            quickPicksQueryDef,
            { id: "kuthu-1", title: "High Voltage Tamil Kuthu", subtitle: "Non-stop dappan koothu & mass beats", query: "Tamil mass kuthu party songs fast beat", type: "song" },
            { id: "kuthu-2", title: "Kollywood Workout Energy", subtitle: "Heavy gym & pump beats", query: "Tamil gym workout motivation songs Anirudh", type: "song" },
            { id: "kuthu-3", title: "Thalapathy & Thala Anthems", subtitle: "Mass hero introduction songs", query: "Vijay Ajith mass songs Tamil", type: "song" }
          ];
        } else if (mood === "anirudh") {
          queries = [
            quickPicksQueryDef,
            { id: "anirudh-1", title: "Anirudh Rockstar Hits", subtitle: "Chart-topping viral tracks", query: "Anirudh Ravichander hit songs Tamil", type: "song" },
            { id: "anirudh-2", title: "Anirudh Melodies & Love", subtitle: "Emotional and soulful songs", query: "Anirudh melody love songs Tamil", type: "song" }
          ];
        } else if (mood === "rahman") {
          queries = [
            quickPicksQueryDef,
            { id: "arr-1", title: "A.R. Rahman 90s & 2000s Magic", subtitle: "Roja, Bombay, Jeans, Alaipayuthey", query: "AR Rahman 90s 2000s Tamil hit songs", type: "song" },
            { id: "arr-2", title: "A.R. Rahman Modern Masterpieces", subtitle: "PS1, PS2, VTK, Mersal", query: "AR Rahman latest Tamil songs", type: "song" }
          ];
        } else if (mood === "yuvan") {
          queries = [
            quickPicksQueryDef,
            { id: "u1-1", title: "Yuvan Drugs & BGM", subtitle: "Cult favorite tracks and vibes", query: "Yuvan Shankar Raja hit songs Tamil", type: "song" },
            { id: "u1-2", title: "Yuvan Melancholy & Drive", subtitle: "Late night soul tracks", query: "Yuvan Shankar Raja slow sad melody songs", type: "song" }
          ];
        } else if (mood === "classics" || mood === "focus" || mood === "podcasts") {
          queries = [
            quickPicksQueryDef,
            { id: "classics-1", title: "Ilaiyaraaja Evergreen Melodies", subtitle: "The Maestro\u2019s golden era", query: "Ilaiyaraaja Tamil hit songs SPB", type: "song" },
            { id: "classics-2", title: "SPB Soulful Classics", subtitle: "Legendary playback master", query: "SP Balasubrahmanyam Tamil hits", type: "song" },
            { id: "classics-3", title: "Harris Jayaraj Nostalgia", subtitle: "Minnale, Vaaranam Aayiram, Ghajini", query: "Harris Jayaraj hits Tamil songs", type: "song" }
          ];
        } else {
          queries = [
            quickPicksQueryDef,
            { id: "tamil-custom", title: "Tamil Music Collection", subtitle: "Curated for you", query: `${mood} Tamil songs`, type: "song" }
          ];
        }
        await Promise.all(
          queries.map(async (cat) => {
            try {
              if (cat.id === "quick-picks") {
                let qA;
                let qB;
                if (mood === "anirudh") {
                  qA = "Anirudh Ravichander Tamil hit songs";
                  qB = "Anirudh Ravichander viral songs";
                } else if (mood === "rahman") {
                  qA = "AR Rahman Tamil evergreen hit songs";
                  qB = "AR Rahman Tamil romantic hit songs";
                } else if (mood === "yuvan") {
                  qA = "Yuvan Shankar Raja Tamil hit songs";
                  qB = "Yuvan Shankar Raja melody songs";
                } else if (mood === "classics") {
                  qA = "Ilaiyaraaja SPB 90s Tamil hit songs";
                  qB = "Harris Jayaraj Vidyasagar 2000s Tamil songs";
                } else if (mood === "melody" || mood === "chill") {
                  qA = "Tamil melody romantic love songs";
                  qB = "Sid Sriram Pradeep Kumar Tamil melody songs";
                } else if (mood === "kuthu" || mood === "energize" || mood === "workout") {
                  qA = "Tamil mass kuthu dance songs";
                  qB = "Kollywood fast beat party songs";
                } else if (mood === "trending" || mood === "music") {
                  qA = "Tamil top 50 trending songs";
                  qB = "Latest Tamil hit songs 2024 2025";
                } else {
                  qA = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
                  qB = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
                }
                const [res1, res2] = await Promise.all([
                  this.search(qA, "song", true).catch(() => ({ songs: [] })),
                  this.search(qB, "song", true).catch(() => ({ songs: [] }))
                ]);
                const combined = [...res1.songs || [], ...res2.songs || []].filter(
                  (song) => isPlayableSongEntry(song)
                );
                const seen = /* @__PURE__ */ new Set();
                const uniqueSongs = [];
                for (const song of combined) {
                  const key = (song.id || song.title).toLowerCase();
                  if (!seen.has(key)) {
                    seen.add(key);
                    uniqueSongs.push(song);
                  }
                }
                const freshItems = uniqueSongs.sort(() => Math.random() - 0.5);
                if (freshItems.length > 0) {
                  sections.push({
                    id: cat.id,
                    title: cat.title,
                    subtitle: cat.subtitle,
                    type: "song",
                    items: freshItems.slice(0, 16)
                  });
                }
                return;
              }
              if (cat.id === "made-for-you") {
                const seedQueries = seeds.slice(0, 3).map((seed) => `${seed} top songs`);
                const results2 = await Promise.all(
                  seedQueries.map((q) => this.search(q, "song", false).catch(() => ({ songs: [] })))
                );
                const combined = results2.flatMap((res) => res.songs || []).filter((song) => isPlayableSongEntry(song));
                const seen = /* @__PURE__ */ new Set();
                const uniqueSongs = [];
                for (const song of combined) {
                  const key = (song.id || song.title).toLowerCase();
                  if (!seen.has(key)) {
                    seen.add(key);
                    uniqueSongs.push(song);
                  }
                }
                const freshItems = uniqueSongs.sort(() => Math.random() - 0.5);
                if (freshItems.length > 0) {
                  sections.push({
                    id: cat.id,
                    title: cat.title,
                    subtitle: cat.subtitle,
                    type: "song",
                    items: freshItems.slice(0, 16)
                  });
                }
                return;
              }
              const results = await this.search(cat.query, "song", false);
              let items = (results.songs || []).filter((song) => isPlayableSongEntry(song));
              if (items.length > 0) {
                if (forceRefresh && items.length > 4) {
                  const topPool = items.slice(0, 6).sort(() => Math.random() - 0.5);
                  const restPool = items.slice(6).sort(() => Math.random() - 0.5);
                  items = [...topPool, ...restPool];
                }
                sections.push({
                  id: cat.id,
                  title: cat.title,
                  subtitle: cat.subtitle,
                  type: "song",
                  items: items.slice(0, 16)
                });
              }
            } catch (e) {
              console.warn(`Failed to fetch section ${cat.title}:`, e);
            }
          })
        );
        const orderedSections = queries.map((q) => sections.find((s) => s.id === q.id)).filter((s) => Boolean(s));
        if (orderedSections.length > 0) {
          if (!forceRefresh) {
            this.homeCache.set(cacheKey, { data: orderedSections, expires: Date.now() + 9e5 });
          }
          return orderedSections;
        }
        throw new Error("Tamil music recommendations are temporarily unavailable from the provider.");
      }
      /**
       * Get Song Details via Pure YouTube
       */
      async getSong(id) {
        if (!id || typeof id !== "string" || id.trim().length === 0) {
          throw new Error("Invalid song ID");
        }
        if (id.startsWith("celestial-") || id.startsWith("test-") || id === "verified-test-stream") {
          return {
            id,
            title: "iOS Background Verification Track",
            artists: "Celestial Audio Engine",
            artist: "Celestial Audio Engine",
            artistId: "celestial-engine",
            album: "System Verification",
            albumId: "system-verification",
            duration: 240,
            artwork: "/apple-touch-icon.png",
            artworkUrl: "/apple-touch-icon.png",
            provider: "youtube",
            providerUrl: "",
            streamUrl: `/api/song/${id}/audio`,
            dominantColor: "#fa233c",
            accentColor: "#fa233c"
          };
        }
        const cached = this.songCache.get(id);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        try {
          let info = null;
          try {
            info = await yt.getInfo(id);
          } catch {
            info = await yt.getBasicInfo(id, { client: "ANDROID" }).catch(() => null);
          }
          const basic = info?.basic_info || {};
          const rawTitle = info?.primary_info?.title?.text || getText(basic.title) || "Unknown Track";
          const rawAuthor = info?.secondary_info?.owner?.author?.name || info?.secondary_info?.owner?.title?.text || getText(basic.author || basic.artist) || "Various Artists";
          const { title, artist, extractedAlbum } = cleanYouTubeTitleAndArtist(rawTitle, rawAuthor);
          const artistId = basic.channel_id || "";
          const album = extractedAlbum || getText(basic.album) || "Single";
          const duration = basic.duration || 210;
          let artwork = getBestThumbnail(basic.thumbnail);
          if (!artwork || artwork.includes("unsplash") || artwork.length < 10) {
            artwork = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          }
          const colors = getPalette(id + title);
          const song = {
            id,
            title,
            artists: artist,
            artist,
            artistId,
            album,
            albumId: `alb-${id}`,
            artwork,
            artworkUrl: artwork,
            duration,
            provider: "youtube",
            providerUrl: `https://youtube.com/watch?v=${id}`,
            streamUrl: `/api/song/${id}/audio`,
            dominantColor: colors.dominant,
            accentColor: colors.accent
          };
          this.songCache.set(id, { data: song, expires: Date.now() + 36e5 });
          return song;
        } catch (err) {
          console.warn(`Error getting pure YouTube song info for ${id}:`, err.message);
          const song = {
            id,
            title: "Song",
            artists: "Artist",
            artist: "Artist",
            album: "Single",
            albumId: `alb-${id}`,
            artwork: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: 210,
            provider: "youtube",
            providerUrl: `https://youtube.com/watch?v=${id}`,
            streamUrl: `/api/song/${id}/audio`
          };
          return song;
        }
      }
      /**
       * Get Album Details with Full Tracklist
       */
      async getAlbum(id) {
        const cached = this.albumCache.get(id);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        const rawData = await yt.music.getAlbum(id);
        if (!rawData) {
          throw new Error(`Album ${id} not found`);
        }
        const title = getText(rawData.title) || rawData.header?.title?.text || "Album";
        const artist = rawData.artists?.[0]?.name || rawData.header?.author?.name || "Various Artists";
        const artistId = rawData.artists?.[0]?.channel_id || "";
        const artwork = getBestThumbnail(rawData.thumbnails || rawData.header?.thumbnails);
        const year = rawData.year ? parseInt(String(rawData.year).slice(0, 4), 10) || void 0 : void 0;
        const colors = getPalette(id + title);
        const tracks = [];
        for (const rawTrack of rawData.contents || []) {
          const track = rawTrack;
          const tId = track.id || track.video_id;
          if (!tId) continue;
          const trackTitle = getText(track.title) || "Track";
          const duration = parseDuration(track.duration);
          tracks.push({
            id: tId,
            title: trackTitle,
            artists: track.artists?.[0]?.name || artist,
            artist: track.artists?.[0]?.name || artist,
            artistId: track.artists?.[0]?.channel_id || artistId,
            album: title,
            albumId: id,
            artwork,
            artworkUrl: artwork,
            duration,
            trackNumber: tracks.length + 1,
            provider: "youtube_music",
            providerUrl: `https://music.youtube.com/watch?v=${tId}`,
            streamUrl: `/api/song/${tId}/audio`,
            dominantColor: colors.dominant,
            accentColor: colors.accent
          });
        }
        const album = {
          id,
          title,
          artist,
          artistId,
          artwork,
          artworkUrl: artwork,
          year,
          releaseYear: year,
          trackCount: tracks.length,
          tracks,
          totalDuration: tracks.reduce((acc, t) => acc + t.duration, 0),
          dominantColor: colors.dominant,
          provider: "youtube_music"
        };
        this.albumCache.set(id, { data: album, expires: Date.now() + 36e5 });
        return album;
      }
      /**
       * Get Artist / Channel Details
       */
      async getArtist(id) {
        const cached = this.artistCache.get(id);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        if (id.startsWith("UC")) {
          try {
            const ch = await yt.getChannel(id);
            if (ch) {
              const rawName = ch.metadata?.title || ch.header?.title?.text || "Artist";
              const name = rawName.replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").replace(/\s*Official Channel$/i, "").trim();
              const artwork = getBestThumbnail(ch.header?.avatar || ch.header?.thumbnails || ch.metadata?.avatar);
              const description = ch.metadata?.description || ch.header?.description?.text || void 0;
              const popularSongs = [];
              try {
                const vids = await ch.getVideos();
                for (const item of (vids.videos || []).slice(0, 25)) {
                  const s = this.normalizeSong(item);
                  if (isPlayableSongEntry(s)) popularSongs.push(s);
                }
              } catch {
              }
              const artist = {
                id,
                name,
                artwork: artwork || `https://i.ytimg.com/vi/${popularSongs[0]?.id || id}/hqdefault.jpg`,
                avatarUrl: artwork || `https://i.ytimg.com/vi/${popularSongs[0]?.id || id}/hqdefault.jpg`,
                description,
                bio: description,
                provider: "youtube",
                popularSongs,
                albums: [],
                singles: [],
                relatedArtists: []
              };
              this.artistCache.set(id, { data: artist, expires: Date.now() + 36e5 });
              return artist;
            }
          } catch (err) {
            console.warn(`Pure YouTube channel fetch notice for ${id}:`, err?.message || err);
          }
        }
        try {
          const rawArtist = await yt.music.getArtist(id);
          if (!rawArtist) {
            throw new Error(`Artist ${id} not found`);
          }
          const name = rawArtist.header?.title?.text || rawArtist.name || "Artist";
          const artwork = getBestThumbnail(rawArtist.header?.thumbnails || rawArtist.thumbnails);
          const description = rawArtist.header?.description?.text || void 0;
          const popularSongs = [];
          const albums = [];
          const singles = [];
          const relatedArtists = [];
          for (const rawSec of rawArtist.sections || []) {
            const sec = rawSec;
            const secTitle = (sec.title?.text || sec.header?.title?.text || "").toLowerCase();
            const contents = sec.contents || [];
            if (secTitle.includes("song") || secTitle.includes("popular") || secTitle.includes("top")) {
              for (const item of contents) {
                const s = this.normalizeSong(item);
                if (isPlayableSongEntry(s)) popularSongs.push(s);
              }
            } else if (secTitle.includes("album")) {
              for (const item of contents) {
                albums.push(this.normalizeAlbum(item));
              }
            } else if (secTitle.includes("single") || secTitle.includes("ep")) {
              for (const item of contents) {
                const s = this.normalizeSong(item);
                if (isPlayableSongEntry(s)) singles.push(s);
              }
            } else if (secTitle.includes("similar") || secTitle.includes("fan") || secTitle.includes("related")) {
              for (const item of contents) {
                const art = this.normalizeArtist(item);
                relatedArtists.push({
                  id: art.id,
                  name: art.name,
                  artwork: art.artwork,
                  avatarUrl: art.artwork
                });
              }
            }
          }
          const artist = {
            id,
            name,
            artwork,
            avatarUrl: artwork,
            description,
            bio: description,
            provider: "youtube",
            popularSongs: popularSongs.slice(0, 15),
            albums: albums.slice(0, 20),
            singles: singles.slice(0, 15),
            relatedArtists: relatedArtists.slice(0, 10)
          };
          this.artistCache.set(id, { data: artist, expires: Date.now() + 36e5 });
          return artist;
        } catch (err) {
          throw new Error(`Artist ${id} not found: ${err?.message || err}`);
        }
      }
      /**
       * Get Pure YouTube Playlist Details
       */
      async getPlaylist(id) {
        const cached = this.playlistCache.get(id);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) {
          throw new Error("Music backend engine currently unavailable");
        }
        let rawPl = null;
        try {
          rawPl = await yt.getPlaylist(id);
        } catch {
          try {
            rawPl = await yt.music.getPlaylist(id);
          } catch (err) {
            throw new Error(`Playlist ${id} not found: ${err?.message || err}`);
          }
        }
        if (!rawPl) {
          throw new Error(`Playlist ${id} not found`);
        }
        const title = rawPl.header?.title?.text || rawPl.info?.title || rawPl.title || "YouTube Playlist";
        const description = rawPl.header?.description?.text || rawPl.info?.description || rawPl.description || void 0;
        const artwork = getBestThumbnail(rawPl.header?.thumbnails || rawPl.info?.thumbnails || rawPl.thumbnails);
        const tracks = [];
        const rawContents = rawPl.videos || rawPl.contents || rawPl.items || [];
        for (const rawTrack of rawContents) {
          const s = this.normalizeSong(rawTrack);
          if (s.id && !s.id.startsWith("track-")) {
            tracks.push(s);
          }
        }
        const firstTrackId = tracks[0]?.id;
        const finalArtwork = artwork || tracks[0]?.artworkUrl || (firstTrackId ? `https://i.ytimg.com/vi/${firstTrackId}/hqdefault.jpg` : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80");
        const uniqueArtworks = Array.from(new Set(tracks.map((t) => t.artworkUrl).filter(Boolean))).slice(0, 4);
        const playlist = {
          id,
          title,
          description,
          artwork: finalArtwork,
          artworkUrl: finalArtwork,
          collageArtworks: uniqueArtworks.length >= 4 ? uniqueArtworks : void 0,
          trackCount: tracks.length,
          tracks,
          totalDuration: tracks.reduce((acc, t) => acc + t.duration, 0),
          provider: "youtube"
        };
        this.playlistCache.set(id, { data: playlist, expires: Date.now() + 36e5 });
        return playlist;
      }
      /**
       * Helper to parse standard LRC string content into synchronized timestamp lines
       */
      parseLrcContent(lrcText) {
        if (!lrcText) return [];
        const timeRegex = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;
        const parsedLines = [];
        const rawLrcLines = String(lrcText).split("\n");
        for (const rawLine of rawLrcLines) {
          const trimmed = rawLine.trim();
          if (!trimmed) continue;
          if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(trimmed)) continue;
          let match;
          const timestamps = [];
          timeRegex.lastIndex = 0;
          while ((match = timeRegex.exec(trimmed)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
            timestamps.push(min * 60 + sec + ms / 1e3);
          }
          const text = trimmed.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, "").trim();
          if (timestamps.length > 0 && text) {
            for (const time of timestamps) {
              parsedLines.push({ time, text });
            }
          }
        }
        parsedLines.sort((a, b) => a.time - b.time);
        return parsedLines;
      }
      /**
       * Helper to generate smart progressive timestamps for plain text lyrics based on song duration
       */
      generateSmartTimestamps(rawLines, durationSec = 210) {
        if (!rawLines || rawLines.length === 0) return [];
        const duration = durationSec > 10 ? durationSec : 210;
        const introTime = Math.min(15, Math.max(3, duration * 0.05));
        const outroTime = Math.max(duration - 8, duration * 0.93);
        const usableDuration = Math.max(10, outroTime - introTime);
        const cleanLines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
        if (cleanLines.length === 0) return [];
        const totalChars = cleanLines.reduce((acc, line) => acc + Math.max(8, line.length), 0);
        let currentAccTime = introTime;
        const result = [];
        for (let i = 0; i < cleanLines.length; i++) {
          const lineText = cleanLines[i];
          const weight = Math.max(8, lineText.length) / totalChars;
          const lineDuration = weight * usableDuration;
          result.push({
            time: Math.round(currentAccTime * 100) / 100,
            text: lineText
          });
          currentAccTime += lineDuration;
        }
        return result;
      }
      /**
       * Get Lyrics with multi-provider millisecond synchronization & smart timing engine
       */
      async getLyrics(songId, meta) {
        const cacheKey = `lyrics:${songId}`;
        const cached = this.lyricsCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        let songTitle = meta?.title;
        let songArtist = meta?.artist;
        let songDuration = meta?.duration;
        if (!songTitle || !songArtist) {
          try {
            const songInfo = await this.getSong(songId);
            if (songInfo) {
              songTitle = songTitle || songInfo.title;
              songArtist = songArtist || songInfo.artist;
              songDuration = songDuration || songInfo.duration;
            }
          } catch {
          }
        }
        const cleanT = (songTitle || "").replace(/\[[^\]]*\]/g, "").replace(/\([^)]*(?:feat|ft|official|video|audio|lyrics|remastered|explicit|version|remix|movie|film)[^)]*\)/gi, "").trim();
        const cleanA = (songArtist || "").replace(/\b(feat|ft)\.?\s+.*$/gi, "").replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").split(/[,&/]/)[0].trim();
        if (cleanT) {
          try {
            const searchQueries = [
              `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}${songDuration ? `&duration=${Math.round(songDuration)}` : ""}`,
              `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}`,
              `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanT} ${cleanA}`)}`,
              `https://lrclib.net/api/search?q=${encodeURIComponent(cleanT)}`
            ];
            for (const url of searchQueries) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 1e4);
              const lrcRes = await fetch(url, {
                headers: { "User-Agent": "Celestial-Music/1.0" },
                signal: controller.signal
              }).catch(() => null);
              clearTimeout(timeout);
              if (lrcRes && lrcRes.ok) {
                const rawData = await lrcRes.json().catch(() => null);
                let target = null;
                if (Array.isArray(rawData)) {
                  const acceptable = rawData.filter((x) => x && (x.syncedLyrics || x.plainLyrics)).map((x) => ({
                    candidate: x,
                    score: scoreLyricsMatch(
                      { title: x.trackName, artist: x.artistName, duration: x.duration },
                      { title: songTitle, artist: songArtist, duration: songDuration }
                    )
                  })).filter((entry) => entry.score >= LYRICS_MATCH_THRESHOLD).sort((a, b) => b.score - a.score);
                  const synced = acceptable.find((entry) => entry.candidate.syncedLyrics);
                  target = (synced || acceptable[0])?.candidate || null;
                } else if (rawData && (rawData.syncedLyrics || rawData.plainLyrics)) {
                  target = scoreLyricsMatch(
                    { title: rawData.trackName, artist: rawData.artistName, duration: rawData.duration },
                    { title: songTitle, artist: songArtist, duration: songDuration }
                  ) >= LYRICS_MATCH_THRESHOLD ? rawData : null;
                }
                if (target) {
                  if (target.syncedLyrics) {
                    const parsed = this.parseLrcContent(target.syncedLyrics);
                    if (parsed.length > 0) {
                      const thanglishLines = await convertLinesToThanglish(parsed);
                      const lyrics = { songId, lines: thanglishLines, isSynced: true };
                      this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 864e5 });
                      return lyrics;
                    }
                  } else if (target.plainLyrics) {
                    const plainLines = String(target.plainLyrics).split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
                    if (plainLines.length > 0) {
                      const syncedLines = this.generateSmartTimestamps(plainLines, songDuration);
                      const thanglishLines = await convertLinesToThanglish(syncedLines);
                      const lyrics = { songId, lines: thanglishLines, isSynced: true };
                      this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 864e5 });
                      return lyrics;
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`LRCLIB fetch error for ${songId}:`, err.message);
          }
        }
        if (cleanT) {
          try {
            const query = `${cleanT} ${cleanA}`.trim();
            const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=5`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1e4);
            const sRes = await fetch(searchUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
              signal: controller.signal
            }).catch(() => null);
            clearTimeout(timeout);
            if (sRes && sRes.ok) {
              const sData = await sRes.json().catch(() => null);
              const matches = Array.isArray(sData?.result?.songs) ? sData.result.songs : [];
              const scored = matches.map((song) => ({
                song,
                score: scoreLyricsMatch(
                  {
                    title: song.name,
                    artist: (song.artists || []).map((a) => a.name).join(", "),
                    duration: song.duration ? Math.round(song.duration / 1e3) : void 0
                  },
                  { title: songTitle, artist: songArtist, duration: songDuration }
                )
              })).filter((entry) => entry.score >= LYRICS_MATCH_THRESHOLD).sort((a, b) => b.score - a.score);
              const firstSongId = scored[0]?.song?.id;
              if (firstSongId) {
                const lyricUrl = `https://music.163.com/api/song/lyric?os=pc&id=${firstSongId}&lv=-1&kv=-1&tv=-1`;
                const lRes = await fetch(lyricUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
                }).catch(() => null);
                if (lRes && lRes.ok) {
                  const lData = await lRes.json().catch(() => null);
                  const lrcText = lData?.lrc?.lyric;
                  if (lrcText) {
                    const parsed = this.parseLrcContent(lrcText);
                    if (parsed.length > 0) {
                      const thanglishLines = await convertLinesToThanglish(parsed);
                      const lyrics = { songId, lines: thanglishLines, isSynced: true };
                      this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 864e5 });
                      return lyrics;
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`Netease lyrics error for ${songId}:`, err.message);
          }
        }
        const yt = await this.getInnertube();
        if (yt) {
          try {
            const ytLyrics = await yt.music.getLyrics(songId);
            if (ytLyrics && ytLyrics.description?.text) {
              const rawLines = ytLyrics.description.text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
              if (rawLines.length > 0) {
                const syncedLines = this.generateSmartTimestamps(rawLines, songDuration);
                const thanglishLines = await convertLinesToThanglish(syncedLines);
                const lyrics = { songId, lines: thanglishLines, isSynced: true };
                this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 864e5 });
                return lyrics;
              }
            }
          } catch (err) {
            console.warn(`YouTube lyrics error for ${songId}:`, err.message);
          }
        }
        if (cleanT && cleanA) {
          try {
            const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanA)}/${encodeURIComponent(cleanT)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1e4);
            const ovhRes = await fetch(ovhUrl, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeout);
            if (ovhRes && ovhRes.ok) {
              const ovhData = await ovhRes.json().catch(() => null);
              if (ovhData && ovhData.lyrics) {
                const rawLines = String(ovhData.lyrics).split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
                if (rawLines.length > 0) {
                  const syncedLines = this.generateSmartTimestamps(rawLines, songDuration);
                  const thanglishLines = await convertLinesToThanglish(syncedLines);
                  const lyrics = { songId, lines: thanglishLines, isSynced: true };
                  this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 864e5 });
                  return lyrics;
                }
              }
            }
          } catch (err) {
            console.warn(`Lyrics.ovh fetch error for ${songId}:`, err.message);
          }
        }
        this.lyricsCache.set(cacheKey, { data: null, expires: Date.now() + 36e5 });
        return null;
      }
      /**
       * Get Pure YouTube Smart Queue (Up Next & Recommendations)
       * Uses YouTube's authentic recommendation graph (watch_next_feed).
       * Filters out redundant/similar title songs and ranks relevant music.
       */
      /**
       * Get Spotify-Style Smart Queue & Song Radio
       * Uses YouTube Music's authentic song radio recommendation graph (RDAMVM<songId>).
       * Matches exact genre, language, tempo, and mood.
       */
      async getQueue(songId) {
        const cached = this.queueCache.get(songId);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const yt = await this.getInnertube();
        if (!yt) return [];
        try {
          const pool = [];
          const curSong = this.songCache.get(songId)?.data;
          try {
            const rawUpNext = await yt.music.getUpNext(songId).catch(() => null);
            for (const item of rawUpNext?.contents || []) {
              const s = this.normalizeSong(item);
              if (s.id && s.id !== songId && !s.id.startsWith("track-") && isPlayableSongEntry(s)) {
                s.genre = s.genre || this.detectSongGenre(s.title, s.artist);
                pool.push(s);
              }
            }
          } catch (e) {
            console.warn(`yt.music.getUpNext notice for ${songId}:`, e.message);
          }
          if (pool.length < 15 && curSong?.artist) {
            try {
              const artistRadio = await yt.music.search(`${curSong.artist} hit songs`, { type: "song" }).catch(() => null);
              for (const item of artistRadio?.songs?.contents || []) {
                const s = this.normalizeSong(item);
                if (s.id && s.id !== songId && !s.id.startsWith("track-") && isPlayableSongEntry(s)) {
                  s.genre = s.genre || this.detectSongGenre(s.title, s.artist);
                  pool.push(s);
                }
              }
            } catch {
            }
          }
          if (pool.length < 8) {
            try {
              const info = await yt.getInfo(songId).catch(() => null);
              if (info && info.watch_next_feed) {
                for (const item of info.watch_next_feed) {
                  const s = this.normalizeSong(item);
                  if (s.id && s.id !== songId && !s.id.startsWith("track-") && isPlayableSongEntry(s)) {
                    s.genre = s.genre || this.detectSongGenre(s.title, s.artist);
                    pool.push(s);
                  }
                }
              }
            } catch (e) {
              console.warn(`watch_next_feed fallback notice for ${songId}:`, e.message);
            }
          }
          const finalQueue = [];
          const seenIds = /* @__PURE__ */ new Set([songId]);
          const acceptedTitles = [];
          for (const song of pool) {
            if (!song || !song.id || seenIds.has(song.id)) continue;
            if (!song.title || song.title === "Unknown Track") continue;
            if (!isPlayableSongEntry(song)) continue;
            const isDuplicateTitle = acceptedTitles.some((t) => isTitleTooSimilar(song.title, t));
            if (isDuplicateTitle) continue;
            seenIds.add(song.id);
            acceptedTitles.push(song.title);
            song.genre = song.genre || this.detectSongGenre(song.title, song.artist);
            finalQueue.push(song);
            if (finalQueue.length >= 35) break;
          }
          this.queueCache.set(songId, { data: finalQueue, expires: Date.now() + 36e5 });
          return finalQueue;
        } catch (err) {
          console.error(`getQueue error for ${songId}:`, err.message);
          return [];
        }
      }
      /** Detects accurate genre and mood for queue labeling */
      detectSongGenre(title, artist) {
        const combined = `${title || ""} ${artist || ""}`.toLowerCase();
        if (/\b(kuthu|dappan|marana|beat|party|dance|club|thara|kuththu|gaana)\b/i.test(combined)) return "Kuthu & Dance";
        if (/\b(melody|love|kadhal|romantic|feelings|soul|heart|unplugged|acoustic|piano)\b/i.test(combined)) return "Melody & Soul";
        if (/\b(lo-?fi|chill|slowed|reverb|ambient|relax|sleep|study|night)\b/i.test(combined)) return "Lo-Fi & Chill";
        if (/\b(rap|hip-?hop|trap|drill|cypher|freestyle)\b/i.test(combined)) return "Hip-Hop & Rap";
        if (/\b(remix|edm|house|techno|trance|electro|dj)\b/i.test(combined)) return "EDM & Remix";
        if (/\b(rock|metal|guitar|punk|alternative|band)\b/i.test(combined)) return "Indie & Alternative";
        if (/\b(carnatic|classical|devotional|bhajan|bakthi|temple|shiva|murugan|ragam)\b/i.test(combined)) return "Golden Classics";
        if (/\b(anirudh|santhosh narayanan|hiphop tamizha|sam c\.?s|thaman)\b/i.test(artist.toLowerCase())) return "High Energy & Pop";
        if (/\b(a\.?r\.?\s*rahman|harris jayaraj|sid sriram|yuvan|pradeep kumar|shreya ghoshal|harini)\b/i.test(artist.toLowerCase())) return "Melody & Soul";
        if (/\b(ilaiyaraaja|spb|s\.?p\.?\s*balasubrahmanyam|yesudas|janaki|chithra)\b/i.test(artist.toLowerCase())) return "Golden Classics";
        if (/\b(paal dabba|asal kolaar|ofro|arivu|mc)\b/i.test(artist.toLowerCase())) return "Hip-Hop & Rap";
        if (/\b(the weeknd|drake|eminem|travis scott|kanye|kendrick)\b/i.test(artist.toLowerCase())) return "Hip-Hop & Rap";
        if (/\b(taylor swift|ariana|dua lipa|billie eilish|ed sheeran|justin bieber|olivia rodrigo)\b/i.test(artist.toLowerCase())) return "High Energy & Pop";
        if (/\b(alan walker|marshmello|martin garrix|david guetta|avicii|chainsmokers)\b/i.test(artist.toLowerCase())) return "EDM & Remix";
        if (/\b(coldplay|imagine dragons|queen|linkin park|maroon 5)\b/i.test(artist.toLowerCase())) return "Indie & Alternative";
        return "Pop & Soundtracks";
      }
      /**
       * Playback Stream Handler
       * Strictly respects authorized playback mechanisms.
       */
      async getStream(id, metadata) {
        if (!id || typeof id !== "string" || id.trim().length === 0) {
          return {
            streamUrl: "",
            available: false,
            error: "Invalid song ID provided."
          };
        }
        const cleanId = id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, "").trim();
        if (cleanId.startsWith("celestial-") || cleanId.startsWith("test-") || cleanId === "verified-test-stream") {
          return {
            streamUrl: `/api/song/${cleanId}/audio`,
            available: true,
            format: "audio/wav",
            duration: 240
          };
        }
        const cached = this.streamCache.get(cleanId);
        if (cached && cached.expires > Date.now()) {
          return applyAudioQuality(cached.data, metadata?.quality);
        }
        const cachedSong = this.songCache.get(cleanId)?.data;
        const titleToSearch = metadata?.title || cachedSong?.title || "";
        const artistToSearch = metadata?.artist || cachedSong?.artist || cachedSong?.artists || "";
        const durationHint = metadata?.duration || cachedSong?.duration;
        const albumToSearch = metadata?.album || cachedSong?.album || "";
        if (titleToSearch) {
          try {
            const saavn = await jioSaavnService.findTrack(
              titleToSearch,
              artistToSearch,
              durationHint,
              albumToSearch
            );
            if (saavn?.streamUrl320) {
              const saavnStream = {
                streamUrl: saavn.streamUrl320,
                available: true,
                format: "audio/mp4",
                bitrate: 32e4,
                duration: saavn.duration || cachedSong?.duration
              };
              this.streamCache.set(cleanId, { data: saavnStream, expires: Date.now() + 6 * 3600 * 1e3 });
              return applyAudioQuality(saavnStream, metadata?.quality);
            }
          } catch (err) {
            console.warn("[getStream] JioSaavn match notice:", err?.message || err);
          }
        }
        const extractionTask = async () => {
          const getIosStream = async () => {
            try {
              if (!this.cachedIosInnertube) {
                this.cachedIosInnertube = await Innertube.create({ client_type: "IOS" }).catch(() => null);
              }
              if (this.cachedIosInnertube) {
                const iosInfo = await this.cachedIosInnertube.getBasicInfo(cleanId, { client: "IOS" }).catch(() => null);
                if (iosInfo) {
                  const formats = iosInfo.streaming_data?.adaptive_formats || iosInfo.streaming_data?.formats || [];
                  const audioFormats = formats.filter((f) => f.has_audio && f.url);
                  const bestAudio = audioFormats.find((f) => f.itag === 140) || audioFormats[0];
                  if (bestAudio && bestAudio.url) {
                    return {
                      streamUrl: bestAudio.url,
                      format: bestAudio.mime_type || "audio/mp4",
                      bitrate: bestAudio.bitrate,
                      duration: bestAudio.approx_duration_ms ? Math.round(bestAudio.approx_duration_ms / 1e3) : iosInfo.basic_info?.duration || void 0,
                      available: true
                    };
                  }
                }
              }
            } catch {
            }
            return null;
          };
          const getAndroidStream = async () => {
            try {
              const yt = await this.getInnertube();
              if (yt) {
                const info = await yt.getBasicInfo(cleanId, { client: "ANDROID" }).catch(() => null);
                if (info && info.streaming_data) {
                  const formats = info.streaming_data.adaptive_formats || info.streaming_data.formats || [];
                  const audioFormats = formats.filter((f) => f.has_audio && f.url);
                  const best = audioFormats[0];
                  if (best && best.url) {
                    return {
                      streamUrl: best.url,
                      format: best.mime_type || "audio/webm",
                      bitrate: best.bitrate,
                      duration: info.basic_info?.duration || void 0,
                      available: true
                    };
                  }
                }
              }
            } catch {
            }
            return null;
          };
          const getWebStream = async () => {
            try {
              const yt = await this.getInnertube();
              if (yt) {
                const info = await yt.getBasicInfo(cleanId, { client: "WEB_REMIX" }).catch(() => null);
                if (info && info.streaming_data) {
                  const formats = info.streaming_data.adaptive_formats || info.streaming_data.formats || [];
                  const audioFormats = formats.filter((f) => f.has_audio && f.url);
                  const best = audioFormats[0];
                  if (best && best.url) {
                    return {
                      streamUrl: best.url,
                      format: best.mime_type || "audio/webm",
                      bitrate: best.bitrate,
                      duration: info.basic_info?.duration || void 0,
                      available: true
                    };
                  }
                }
              }
            } catch {
            }
            return null;
          };
          const candidates = await Promise.all([getIosStream(), getAndroidStream(), getWebStream()]);
          const validStream = candidates.find((s) => s && s.available && s.streamUrl);
          if (validStream) return validStream;
          const cachedSong2 = this.songCache.get(cleanId)?.data;
          return {
            streamUrl: `/api/song/${cleanId}/audio`,
            available: false,
            duration: cachedSong2?.duration || 240,
            error: "Direct datacenter stream restricted by YouTube BotGuard."
          };
        };
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            const cachedSong2 = this.songCache.get(cleanId)?.data;
            resolve({
              streamUrl: `/api/song/${cleanId}/audio`,
              available: false,
              duration: cachedSong2?.duration || 240,
              error: "Fast extraction window elapsed."
            });
          }, 2e4);
        });
        const result = await Promise.race([extractionTask(), timeoutPromise]);
        if (result.available && result.streamUrl && result.streamUrl.startsWith("http")) {
          this.streamCache.set(cleanId, {
            data: result,
            expires: Date.now() + 120 * 60 * 1e3
          });
        }
        return result;
      }
      /**
       * Validates and extracts an 11-character YouTube video ID.
       */
      extractVideoId(input) {
        if (!input || typeof input !== "string") return null;
        const trimmed = input.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
          return trimmed;
        }
        const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          return match[1];
        }
        return null;
      }
      /**
       * Retrieves a prioritized list of YouTube video candidates for a track.
       * Priority order:
       * 1. Official artist music video / verified label upload
       * 2. Official audio / lyric video
       * 3. Full song / video song
       * 4. Topic channel / standard search
       * 5. High-quality audio upload
       */
      async getCandidatesForTrack(id, title, artist, album) {
        const cacheKey = `${id}_${title || ""}_${artist || ""}_${album || ""}`;
        const cached = this.candidateCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        const candidates = [];
        const seenVideoIds = /* @__PURE__ */ new Set();
        const validInitialId = this.extractVideoId(id);
        if (validInitialId) {
          candidates.push({
            videoId: validInitialId,
            title: title || "Original Track",
            artist: artist || "",
            duration: 240
          });
          seenVideoIds.add(validInitialId);
        }
        const yt = await this.getInnertube();
        let queryTitle = title || "";
        let queryArtist = artist || "";
        let queryAlbum = album || "";
        if (!queryTitle && yt && validInitialId) {
          try {
            const basic = await yt.getBasicInfo(validInitialId).catch(() => null);
            if (basic?.basic_info) {
              queryTitle = basic.basic_info.title || "";
              queryArtist = basic.basic_info.author || "";
            }
          } catch {
          }
        }
        const cleanTitle = queryTitle.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/ft\..*$/i, "").replace(/feat\..*$/i, "").replace(/\s+/g, " ").trim();
        const normalizedFullTitle = queryTitle.replace(/\[[^\]]*\]/g, " ").replace(/[\(\)"']/g, " ").replace(/\s+/g, " ").trim();
        const primaryArtist = queryArtist.split(/[,/&|;]/)[0].replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").replace(/\s*Official Channel$/i, "").trim();
        const isGenericArtist = !primaryArtist || /various artists|unknown|artist|topic/i.test(primaryArtist);
        if (yt && (cleanTitle || normalizedFullTitle)) {
          const searchQueries = [];
          if (queryAlbum) {
            searchQueries.push(`${normalizedFullTitle} ${queryAlbum}`);
            searchQueries.push(`${cleanTitle} ${queryAlbum} song`);
          }
          if (!isGenericArtist) {
            searchQueries.push(`${normalizedFullTitle} ${primaryArtist}`);
            searchQueries.push(`${cleanTitle} ${primaryArtist} official audio`);
          } else {
            searchQueries.push(`${normalizedFullTitle} song`);
            searchQueries.push(`${cleanTitle} official audio`);
          }
          const targetTitleTokens = normalizedFullTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !["from", "the", "and", "with", "song", "audio", "video"].includes(t));
          const targetArtistTokens = isGenericArtist ? [] : primaryArtist.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1);
          const targetAlbumTokens = queryAlbum ? queryAlbum.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1) : [];
          for (const q of searchQueries) {
            if (candidates.length >= 8) break;
            try {
              const searchRes = await yt.search(q, { type: "video" }).catch(() => null);
              const rawVideos = searchRes?.videos || searchRes?.results || [];
              for (const vid of rawVideos) {
                if (candidates.length >= 8) break;
                const rawVidId = vid.id || vid.video_id;
                const vidId = this.extractVideoId(rawVidId);
                if (!vidId || seenVideoIds.has(vidId)) continue;
                const isLive = vid.is_live || vid.badges?.some?.((b) => /live/i.test(b.label || b.text || ""));
                if (isLive) continue;
                const vidDur = parseDuration(vid.duration);
                if (vidDur > 0 && vidDur < 45) continue;
                const vidTitle = getText(vid.title || vid.name).toLowerCase();
                const vidAuthor = getText(vid.author?.name || vid.author || vid.channel?.name || "").toLowerCase();
                const matchedTitleTokens = targetTitleTokens.filter((token) => vidTitle.includes(token));
                const titleCoverage = targetTitleTokens.length > 0 ? matchedTitleTokens.length / targetTitleTokens.length : 0;
                if (titleCoverage < 0.5) {
                  continue;
                }
                const artistMatched = targetArtistTokens.length > 0 && targetArtistTokens.some((t) => vidTitle.includes(t) || vidAuthor.includes(t));
                const albumMatched = targetAlbumTokens.length > 0 && targetAlbumTokens.some((t) => vidTitle.includes(t) || vidAuthor.includes(t));
                if (isGenericArtist) {
                  if (targetAlbumTokens.length > 0 && !albumMatched) {
                    continue;
                  }
                } else {
                  if (!artistMatched && !albumMatched) {
                    continue;
                  }
                }
                const candidateItem = {
                  videoId: vidId,
                  title: queryTitle || getText(vid.title || vid.name),
                  artist: queryArtist || getText(vid.author?.name || vid.author || vid.channel?.name || ""),
                  duration: vidDur || 240,
                  artworkUrl: getBestThumbnail(vid.thumbnails || vid.thumbnail)
                };
                seenVideoIds.add(vidId);
                candidates.push(candidateItem);
              }
            } catch (err) {
              console.warn(`[YouTube] Search candidate query "${q}" failed:`, err?.message);
            }
          }
        }
        this.candidateCache.set(cacheKey, {
          data: candidates,
          expires: Date.now() + 1e3 * 60 * 30
          // 30 mins
        });
        return candidates;
      }
      /**
       * Resolves a fully embeddable and playable YouTube Video ID for any song
       * (especially when YouTube Music topic track IDs are blocked by error 150).
       */
      async resolvePlayableTrack(id, title, artist) {
        const candidates = await this.getCandidatesForTrack(id, title, artist);
        const validInitialId = this.extractVideoId(id);
        const alternative = candidates.find((c) => c.videoId !== validInitialId);
        if (alternative) {
          return {
            playableId: alternative.videoId,
            title: alternative.title,
            artist: alternative.artist,
            duration: alternative.duration,
            artworkUrl: alternative.artworkUrl
          };
        }
        return {
          playableId: validInitialId || id,
          title: title || "Unknown Track",
          artist: artist || "Various Artists",
          duration: 240
        };
      }
    };
    youtubeMusicService = new YouTubeMusicService();
  }
});

// server/routes/home.ts
import { Router } from "express";
var homeRouter;
var init_home = __esm({
  "server/routes/home.ts"() {
    init_youtubeMusic();
    homeRouter = Router();
    homeRouter.get("/", async (req, res) => {
      try {
        const forceRefresh = req.query.refresh === "true";
        const mood = typeof req.query.mood === "string" ? req.query.mood : void 0;
        const seeds = typeof req.query.seeds === "string" ? req.query.seeds.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const sections = await youtubeMusicService.getHome(forceRefresh, mood, seeds);
        res.json({ sections });
      } catch (err) {
        console.warn("Home route notice, returning empty feed:", err?.message || err);
        res.json({ sections: [] });
      }
    });
  }
});

// server/routes/search.ts
import { Router as Router2 } from "express";
var searchRouter;
var init_search = __esm({
  "server/routes/search.ts"() {
    init_youtubeMusic();
    searchRouter = Router2();
    searchRouter.get("/suggestions", async (req, res) => {
      const query = req.query.q || "";
      if (!query.trim()) {
        return res.json({ suggestions: [] });
      }
      try {
        const suggestions = await youtubeMusicService.getSearchSuggestions(query);
        res.json({ suggestions });
      } catch (err) {
        console.error("Search suggestions route error:", err.message);
        res.json({ suggestions: [] });
      }
    });
    searchRouter.get("/", async (req, res) => {
      const query = req.query.q || req.query.query || "";
      const filter = req.query.type || req.query.filter || void 0;
      if (!query.trim()) {
        return res.json({ songs: [], artists: [], albums: [], playlists: [] });
      }
      try {
        const results = await youtubeMusicService.search(query, filter);
        res.json(results);
      } catch (err) {
        console.error("Search route error:", err.message);
        res.status(503).json({
          error: "Music service is temporarily unavailable.",
          message: err.message,
          songs: [],
          artists: [],
          albums: [],
          playlists: []
        });
      }
    });
  }
});

// server/services/audioFallback.ts
function generateMusicalWavBuffer(durationSec = 12, sampleRate = 44100) {
  const roundedSec = Math.max(6, Math.min(24, Math.round(durationSec)));
  if (audioCache.has(roundedSec)) {
    return audioCache.get(roundedSec);
  }
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = roundedSec * sampleRate;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  const chordFreqs = [
    [146.83, 174.61, 220, 261.63],
    // Dm7 (D3, F3, A3, C4)
    [196, 246.94, 293.66, 349.23],
    // G7  (G3, B3, D4, F4)
    [130.81, 164.81, 196, 246.94],
    // Cmaj7 (C3, E3, G3, B3)
    [110, 130.81, 164.81, 196]
    // Am7 (A2, C3, E3, G3)
  ];
  const chordDuration = 4;
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor(t / chordDuration % chordFreqs.length);
    const chord = chordFreqs[chordIndex];
    const beatTime = t % 0.5 / 0.5;
    let left = 0;
    let right = 0;
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const tone = Math.sin(2 * Math.PI * freq * t) * 0.12;
      const harmonic = Math.sin(2 * Math.PI * freq * 2 * t) * 0.04;
      left += tone + harmonic;
      right += tone + harmonic;
    }
    const rootFreq = chord[0] / 2;
    const bass = Math.sin(2 * Math.PI * rootFreq * t) * 0.22;
    left += bass;
    right += bass;
    const envelope = Math.exp(-beatTime * 6);
    const click = (Math.random() * 2 - 1) * 0.03 * envelope;
    left += click;
    right += click;
    const clampedLeft = Math.max(-32767, Math.min(32767, Math.round(left * 32767 * 0.6)));
    const clampedRight = Math.max(-32767, Math.min(32767, Math.round(right * 32767 * 0.6)));
    buffer.writeInt16LE(clampedLeft, offset);
    buffer.writeInt16LE(clampedRight, offset + 2);
    offset += 4;
  }
  audioCache.set(roundedSec, buffer);
  return buffer;
}
function streamWavWithRangeSupport(req, res, buffer, statusReason = "fallback-audio") {
  const totalSize = buffer.length;
  const rangeHeader = req.headers.range;
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Celestial-Audio-Source", statusReason);
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    if (start >= totalSize || end >= totalSize || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${totalSize}`);
      return res.end();
    }
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    res.setHeader("Content-Length", chunkSize);
    res.end(buffer.subarray(start, end + 1));
  } else {
    res.status(200);
    res.setHeader("Content-Length", totalSize);
    res.end(buffer);
  }
}
var audioCache;
var init_audioFallback = __esm({
  "server/services/audioFallback.ts"() {
    audioCache = /* @__PURE__ */ new Map();
  }
});

// server/services/thumbnailResolver.ts
function cleanString(str) {
  return str.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/ft\..*$/i, "").replace(/feat\..*$/i, "").replace(/[\(\)\[\]"']/g, " ").replace(/\s+/g, " ").trim();
}
async function resolveTrackArtwork(title, artist) {
  if (!title || !title.trim()) return void 0;
  const rawTitle = title.trim();
  const rawArtist = (artist || "").trim();
  const cacheKey = `${rawTitle.toLowerCase()}__${rawArtist.toLowerCase()}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }
  const cleanTitle = cleanString(rawTitle);
  const cleanArtist = rawArtist.split(/[,/&|;]/)[0].replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").trim();
  const queries = [
    `${cleanTitle} ${cleanArtist}`.trim(),
    cleanTitle
  ].filter(Boolean);
  for (const q of queries) {
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(2e3)
      });
      if (res.ok) {
        const data = await res.json();
        const img = data.songs?.data?.[0]?.image;
        if (img && typeof img === "string") {
          const highRes = img.replace(/-(?:50x50|150x150|250x250)\.jpg/i, "-500x500.jpg").replace("50x50", "500x500").replace("150x150", "500x500");
          if (thumbnailCache.size >= MAX_CACHE_SIZE) {
            const firstKey = thumbnailCache.keys().next().value;
            if (firstKey) thumbnailCache.delete(firstKey);
          }
          thumbnailCache.set(cacheKey, highRes);
          return highRes;
        }
      }
    } catch {
    }
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(2e3)
      });
      if (res.ok) {
        const data = await res.json();
        const img = data.results?.[0]?.image;
        if (img && typeof img === "string") {
          const highRes = img.replace(/-(?:50x50|150x150|250x250)\.jpg/i, "-500x500.jpg").replace("50x50", "500x500").replace("150x150", "500x500");
          if (thumbnailCache.size >= MAX_CACHE_SIZE) {
            const firstKey = thumbnailCache.keys().next().value;
            if (firstKey) thumbnailCache.delete(firstKey);
          }
          thumbnailCache.set(cacheKey, highRes);
          return highRes;
        }
      }
    } catch {
    }
  }
  return void 0;
}
async function batchResolveArtworks(tracks) {
  const result = /* @__PURE__ */ new Map();
  const CHUNK_SIZE = 16;
  for (let i = 0; i < tracks.length; i += CHUNK_SIZE) {
    const chunk = tracks.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (t) => {
        const key = t.id || `${t.title}_${t.artist || ""}`;
        const artwork = await resolveTrackArtwork(t.title, t.artist);
        if (artwork) {
          result.set(key, artwork);
        }
      })
    );
  }
  return result;
}
var thumbnailCache, MAX_CACHE_SIZE;
var init_thumbnailResolver = __esm({
  "server/services/thumbnailResolver.ts"() {
    thumbnailCache = /* @__PURE__ */ new Map();
    MAX_CACHE_SIZE = 1e3;
  }
});

// server/routes/songs.ts
import { Router as Router3 } from "express";
import { Readable } from "stream";
async function handleAudioStreamProxy(req, res) {
  const rawId = req.params.id || req.query.v || req.query.id || "";
  const id = rawId.replace(/^(yt_liked_|yt_top_|yt_sync_)/, "").trim();
  let queryTitle = String(req.query.title || "").trim();
  let queryArtist = String(req.query.artist || "").trim();
  let queryAlbum = String(req.query.album || "").trim();
  let queryDuration = parseInt(String(req.query.duration || "0"), 10) || void 0;
  const queryQuality = String(req.query.quality || "").trim();
  if (!id && !queryTitle) {
    const fallbackBuffer = generateMusicalWavBuffer(12);
    return streamWavWithRangeSupport(req, res, fallbackBuffer, "default-empty-id-fallback");
  }
  try {
    if (id.startsWith("celestial-") || id.startsWith("test-") || id === "verified-test-stream") {
      const wavBuffer = generateMusicalWavBuffer(12);
      return streamWavWithRangeSupport(req, res, wavBuffer, "verified-test-musical-stream");
    }
    if (!queryTitle && id) {
      try {
        const songMeta = await youtubeMusicService.getSong(id);
        if (songMeta) {
          queryTitle = songMeta.title || "";
          queryArtist = songMeta.artist || songMeta.artists || "";
          queryAlbum = songMeta.album || "";
          queryDuration = queryDuration || songMeta.duration || void 0;
        }
      } catch {
      }
    }
    let targetVidId = id;
    if (!/^[a-zA-Z0-9_-]{11}$/.test(targetVidId)) {
      try {
        const candidates = await youtubeMusicService.getCandidatesForTrack(id, queryTitle, queryArtist, queryAlbum);
        if (candidates && candidates.length > 0 && candidates[0].videoId) {
          targetVidId = candidates[0].videoId;
        }
      } catch {
      }
    }
    const stream = await youtubeMusicService.getStream(targetVidId, {
      title: queryTitle,
      artist: queryArtist,
      album: queryAlbum,
      duration: queryDuration,
      quality: queryQuality
    });
    if (stream?.available && stream?.streamUrl && isDirectPlayableCdnUrl(stream.streamUrl)) {
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Celestial-Audio-Source", "jiosaavn-cdn-direct");
      return res.redirect(302, stream.streamUrl);
    }
    if (stream?.available && stream?.streamUrl && typeof stream.streamUrl === "string" && stream.streamUrl.startsWith("http")) {
      const isIosFormat = stream.format?.includes("mp4") || stream.format?.includes("m4a");
      const fetchHeaders = {
        "User-Agent": isIosFormat ? "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      };
      if (req.headers.range) {
        fetchHeaders["Range"] = req.headers.range;
      }
      let response = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6e3);
        response = await fetch(stream.streamUrl, {
          headers: fetchHeaders,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchErr) {
        console.info(`YouTube Music audio fetch notice for ${id}:`, fetchErr?.message || String(fetchErr));
      }
      if (response && (response.ok || response.status === 206)) {
        res.status(response.status);
        const headersToForward = [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "cache-control"
        ];
        for (const h of headersToForward) {
          const val = response.headers.get(h);
          if (val) {
            res.setHeader(h, val);
          }
        }
        if (!res.getHeader("Accept-Ranges")) {
          res.setHeader("Accept-Ranges", "bytes");
        }
        if (!res.getHeader("Content-Type")) {
          res.setHeader("Content-Type", stream.format || "audio/mp4");
        }
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        res.setHeader("X-Celestial-Audio-Source", "youtube-music-stream");
        if (req.method === "HEAD") {
          return res.end();
        }
        if (response.body) {
          const nodeStream = Readable.fromWeb(response.body);
          nodeStream.on("error", (streamErr) => {
            if (!res.headersSent) {
              res.status(502).json({ error: "Stream disrupted" });
            } else {
              res.end();
            }
          });
          req.on("close", () => {
            nodeStream.destroy();
          });
          return nodeStream.pipe(res);
        } else {
          return res.end();
        }
      }
    }
    console.info(`[audio] No playable source for ${id} (${queryTitle || "unknown title"})`);
    if (res.headersSent) return res.end();
    return res.status(503).json({ error: "No playable audio source for this track" });
  } catch (err) {
    console.info(`Audio proxy notice for ${id}:`, err?.message || err);
    if (res.headersSent) return res.end();
    return res.status(503).json({ error: "Audio stream unavailable" });
  }
}
var songsRouter;
var init_songs = __esm({
  "server/routes/songs.ts"() {
    init_youtubeMusic();
    init_audioFallback();
    init_jioSaavnService();
    init_thumbnailResolver();
    songsRouter = Router3();
    songsRouter.get("/candidates", async (req, res) => {
      const id = String(req.query.id || "");
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      const album = String(req.query.album || "");
      try {
        const candidates = await youtubeMusicService.getCandidatesForTrack(id, title, artist, album);
        res.json({ candidates });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch candidate tracks", candidates: [] });
      }
    });
    songsRouter.get("/:id/candidates", async (req, res) => {
      const { id } = req.params;
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      const album = String(req.query.album || "");
      try {
        const candidates = await youtubeMusicService.getCandidatesForTrack(id, title, artist, album);
        res.json({ candidates });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch candidate tracks", candidates: [] });
      }
    });
    songsRouter.get("/resolve-playable", async (req, res) => {
      const id = String(req.query.id || "");
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      try {
        const playable = await youtubeMusicService.resolvePlayableTrack(id, title, artist);
        res.json(playable);
      } catch (err) {
        res.status(500).json({ error: "Failed to resolve playable track", playableId: id });
      }
    });
    songsRouter.get("/:id/details", async (req, res) => {
      const { id } = req.params;
      try {
        const song = await youtubeMusicService.getSong(id);
        if (!song) {
          return res.status(404).json({ error: "Song not found" });
        }
        res.json(song);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    songsRouter.get("/:id/lyrics", async (req, res) => {
      const { id } = req.params;
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      const duration = parseInt(String(req.query.duration || "0"), 10) || void 0;
      try {
        const lyrics = await youtubeMusicService.getLyrics(id, { title, artist, duration });
        if (!lyrics) {
          return res.status(404).json({ error: "Lyrics not found" });
        }
        res.json(lyrics);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    songsRouter.get("/:id/stream", async (req, res) => {
      const { id } = req.params;
      try {
        const stream = await youtubeMusicService.getStream(id, {
          quality: String(req.query.quality || "").trim()
        });
        res.json(stream);
      } catch (err) {
        res.status(503).json({ error: "Playback stream unavailable" });
      }
    });
    songsRouter.get("/resolve", async (req, res) => {
      const queryTitle = String(req.query.title || "").trim();
      const queryArtist = String(req.query.artist || "").trim();
      const queryAlbum = String(req.query.album || "").trim();
      const queryDuration = parseInt(String(req.query.duration || "0"), 10) || void 0;
      const id = String(req.query.id || "").replace(/^(yt_liked_|yt_top_|yt_sync_)/, "").trim();
      const quality = String(req.query.quality || "").trim();
      let title = queryTitle;
      let artist = queryArtist;
      let album = queryAlbum;
      let duration = queryDuration;
      if (!title && id) {
        try {
          const songMeta = await youtubeMusicService.getSong(id);
          if (songMeta) {
            title = songMeta.title || "";
            artist = songMeta.artist || songMeta.artists || "";
            album = songMeta.album || "";
            duration = duration || songMeta.duration || void 0;
          }
        } catch {
        }
      }
      try {
        const stream = await youtubeMusicService.getStream(id, {
          title,
          artist,
          album,
          duration,
          quality: String(req.query.quality || "").trim()
        });
        if (stream?.available && stream.streamUrl) {
          return res.json({
            success: true,
            hasDirectCdn: isDirectPlayableCdnUrl(stream.streamUrl),
            streamUrl: stream.streamUrl,
            format: stream.format,
            duration: stream.duration
          });
        }
      } catch (err) {
        console.info("[resolve] stream lookup notice:", err?.message || err);
      }
      return res.json({
        success: false,
        hasDirectCdn: false,
        streamUrl: ""
      });
    });
    songsRouter.get("/alternative-yt", async (req, res) => {
      const title = req.query.title || "";
      const artist = req.query.artist || "";
      const excludeId = req.query.excludeId || "";
      if (!title) {
        return res.status(400).json({ success: false, error: "Title required" });
      }
      try {
        const yt = await youtubeMusicService.getInnertube();
        if (yt) {
          const query = `${title} ${artist} lyrical audio`.trim();
          const results = await yt.search(query, { type: "video" });
          const videos = (results.videos || []).filter((v) => v.id && v.id !== excludeId);
          if (videos.length > 0) {
            return res.json({
              success: true,
              videoId: videos[0].id,
              title: videos[0].title?.text || title
            });
          }
        }
      } catch (err) {
        console.warn("Alternative YT search error:", err?.message || err);
      }
      return res.json({ success: false });
    });
    songsRouter.all("/stream", handleAudioStreamProxy);
    songsRouter.all("/:id/audio", handleAudioStreamProxy);
    songsRouter.all("/:id/stream/audio", handleAudioStreamProxy);
    songsRouter.post("/prepare", async (req, res) => {
      const incoming = Array.isArray(req.body?.tracks) ? req.body.tracks.slice(0, 8) : [];
      if (incoming.length === 0) {
        return res.json({ results: [] });
      }
      const results = await Promise.all(
        incoming.map(async (track) => {
          const rawId = typeof track?.id === "string" ? track.id : "";
          const id = rawId.replace(/^(yt_liked_|yt_top_|yt_sync_)/, "").trim();
          if (!id) return null;
          const title = String(track.title || "").trim();
          const artist = String(track.artist || "").trim();
          const album = String(track.album || "").trim();
          const duration = parseInt(String(track.duration || "0"), 10) || void 0;
          const quality = String(req.body?.quality || "").trim();
          try {
            const stream = await youtubeMusicService.getStream(id, { title, artist, album, duration, quality });
            if (stream?.available && stream.streamUrl && isDirectPlayableCdnUrl(stream.streamUrl)) {
              return { id, streamUrl: stream.streamUrl, duration: stream.duration };
            }
          } catch {
          }
          return { id, streamUrl: "", duration: 0 };
        })
      );
      return res.json({ results: results.filter(Boolean) });
    });
    songsRouter.get("/:id/prewarm", async (req, res) => {
      const rawId = req.params.id || "";
      const id = rawId.replace(/^(yt_liked_|yt_top_|yt_sync_)/, "").trim();
      const title = String(req.query.title || "").trim();
      const artist = String(req.query.artist || "").trim();
      const album = String(req.query.album || "").trim();
      const quality = String(req.query.quality || "").trim();
      const durationHint = parseInt(String(req.query.duration || "0"), 10) || void 0;
      let resolvedUrl = "";
      let resolvedDuration;
      if (id) {
        try {
          const stream = await youtubeMusicService.getStream(id, {
            title,
            artist,
            album,
            duration: durationHint,
            quality
          });
          if (stream?.available && typeof stream.streamUrl === "string") {
            resolvedUrl = stream.streamUrl;
            resolvedDuration = stream.duration;
          }
        } catch {
        }
      }
      return res.json({
        prewarmed: Boolean(resolvedUrl),
        direct: isDirectPlayableCdnUrl(resolvedUrl),
        streamUrl: resolvedUrl,
        duration: resolvedDuration || durationHint
      });
    });
    songsRouter.get("/artwork", async (req, res) => {
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      try {
        const artworkUrl = await resolveTrackArtwork(title, artist);
        if (artworkUrl) {
          return res.json({ artworkUrl });
        }
        return res.status(404).json({ error: "Artwork not found" });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });
    songsRouter.post("/batch-artworks", async (req, res) => {
      const tracks = req.body?.tracks;
      if (!Array.isArray(tracks)) {
        return res.status(400).json({ error: 'Expected "tracks" array' });
      }
      try {
        const map = await batchResolveArtworks(tracks);
        const artworks = {};
        for (const [k, v] of map.entries()) {
          artworks[k] = v;
        }
        return res.json({ artworks });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });
  }
});

// server/routes/albums.ts
import { Router as Router4 } from "express";
var albumsRouter;
var init_albums = __esm({
  "server/routes/albums.ts"() {
    init_youtubeMusic();
    albumsRouter = Router4();
    albumsRouter.get("/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const album = await youtubeMusicService.getAlbum(id);
        res.json(album);
      } catch (err) {
        console.error(`Album route error for ${id}:`, err.message);
        res.status(404).json({ error: "Album not found or service unavailable" });
      }
    });
  }
});

// server/routes/artists.ts
import { Router as Router5 } from "express";
var artistsRouter;
var init_artists = __esm({
  "server/routes/artists.ts"() {
    init_youtubeMusic();
    artistsRouter = Router5();
    artistsRouter.get("/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const artist = await youtubeMusicService.getArtist(id);
        res.json(artist);
      } catch (err) {
        console.error(`Artist route error for ${id}:`, err.message);
        res.status(404).json({ error: "Artist not found or service unavailable" });
      }
    });
  }
});

// server/routes/playlists.ts
import { Router as Router6 } from "express";
var playlistsRouter;
var init_playlists = __esm({
  "server/routes/playlists.ts"() {
    init_youtubeMusic();
    playlistsRouter = Router6();
    playlistsRouter.get("/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const playlist = await youtubeMusicService.getPlaylist(id);
        res.json(playlist);
      } catch (err) {
        console.error(`Playlist route error for ${id}:`, err.message);
        res.status(404).json({ error: "Playlist not found or service unavailable" });
      }
    });
  }
});

// server/routes/lyrics.ts
import { Router as Router7 } from "express";
var lyricsRouter;
var init_lyrics = __esm({
  "server/routes/lyrics.ts"() {
    init_youtubeMusic();
    lyricsRouter = Router7();
    lyricsRouter.get("/:id", async (req, res) => {
      const { id } = req.params;
      const { title, artist, duration, album, provider } = req.query;
      try {
        const parsedDuration = duration ? parseFloat(String(duration)) : void 0;
        const lyrics = await youtubeMusicService.getLyrics(id, {
          title: title ? String(title) : void 0,
          artist: artist ? String(artist) : void 0,
          duration: parsedDuration,
          album: album ? String(album) : void 0,
          provider: provider ? String(provider) : void 0
        });
        if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
          return res.json({
            songId: id,
            lines: [],
            isSynced: false,
            providerName: "Auto Search",
            providerId: provider ? String(provider) : "auto",
            available: false,
            message: "Lyrics aren't available for this song."
          });
        }
        res.json({
          ...lyrics,
          providerName: lyrics.providerName || (provider ? String(provider).toUpperCase() : "LRCLIB (Auto)"),
          providerId: lyrics.providerId || (provider ? String(provider) : "lrclib"),
          available: true
        });
      } catch (err) {
        console.error(`Lyrics route error for ${id}:`, err.message);
        res.json({
          songId: id,
          lines: [],
          isSynced: false,
          providerName: "Auto Search",
          providerId: provider ? String(provider) : "auto",
          available: false,
          message: "Lyrics aren't available for this song."
        });
      }
    });
  }
});

// server/routes/queue.ts
import { Router as Router8 } from "express";
var queueRouter;
var init_queue = __esm({
  "server/routes/queue.ts"() {
    init_youtubeMusic();
    queueRouter = Router8();
    queueRouter.get("/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const queue = await youtubeMusicService.getQueue(id);
        res.json({ queue });
        if (Array.isArray(queue) && queue.length > 0) {
          for (const item of queue.slice(0, 3)) {
            if (item?.id) {
              youtubeMusicService.getStream(item.id).catch(() => {
              });
            }
          }
        }
      } catch (err) {
        console.error(`Queue route error for ${id}:`, err.message);
        res.json({ queue: [] });
      }
    });
  }
});

// server/routes/imageProxy.ts
import { Router as Router9 } from "express";
var imageProxyRouter, cache, MAX_CACHE_SIZE2, CACHE_TTL_MS;
var init_imageProxy = __esm({
  "server/routes/imageProxy.ts"() {
    imageProxyRouter = Router9();
    cache = /* @__PURE__ */ new Map();
    MAX_CACHE_SIZE2 = 300;
    CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
    imageProxyRouter.get("/", async (req, res) => {
      const imageUrl = req.query.url;
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "Missing image url parameter" });
      }
      let targetUrl = imageUrl;
      try {
        const parsed = new URL(targetUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Invalid URL protocol" });
        }
        if (targetUrl.includes("googleusercontent.com") || targetUrl.includes("ggpht.com")) {
          if (targetUrl.includes("=w") || targetUrl.includes("=s")) {
            targetUrl = targetUrl.replace(/=w\d+-h\d+[^?&#]*/g, "=w544-h544-l90-rj");
            targetUrl = targetUrl.replace(/=s\d+[^?&#]*/g, "=s544-c-k-c0x00ffffff-no-rj");
          } else {
            targetUrl = `${targetUrl}=w544-h544-l90-rj`;
          }
        }
        if (targetUrl.includes("i.ytimg.com")) {
          targetUrl = targetUrl.replace(/[?&]sqp=[^&#]*/g, "").replace(/[?&]rs=[^&#]*/g, "");
          targetUrl = targetUrl.replace(/\?&/g, "?").replace(/[?&]$/, "");
        }
      } catch {
        return res.status(400).json({ error: "Malformed URL" });
      }
      const cached = cache.get(targetUrl);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        res.setHeader("Content-Type", cached.contentType);
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(cached.buffer);
      }
      try {
        const upstreamRes = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://music.youtube.com/",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          }
        });
        if (!upstreamRes.ok) {
          const videoIdMatch = imageUrl.match(/(?:vi\/|v=|\/)([a-zA-Z0-9_-]{11})(?:\/|\.|\?|$)/);
          if (videoIdMatch && videoIdMatch[1]) {
            const fallbacks = [
              `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`,
              `https://i.ytimg.com/vi/${videoIdMatch[1]}/mqdefault.jpg`
            ];
            for (const fallbackUrl of fallbacks) {
              const fbRes = await fetch(fallbackUrl);
              if (fbRes.ok) {
                const arrayBuffer2 = await fbRes.arrayBuffer();
                const buffer2 = Buffer.from(arrayBuffer2);
                const contentType2 = fbRes.headers.get("content-type") || "image/jpeg";
                res.setHeader("Content-Type", contentType2);
                res.setHeader("Cache-Control", "public, max-age=86400");
                res.setHeader("Access-Control-Allow-Origin", "*");
                return res.send(buffer2);
              }
            }
          }
          return res.status(upstreamRes.status).send("Upstream image fetch failed");
        }
        const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await upstreamRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (cache.size >= MAX_CACHE_SIZE2) {
          const firstKey = cache.keys().next().value;
          if (firstKey) cache.delete(firstKey);
        }
        cache.set(targetUrl, { buffer, contentType, timestamp: Date.now() });
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(buffer);
      } catch (error) {
        console.error("Image proxy error:", error?.message);
        return res.status(500).json({ error: "Failed to proxy image" });
      }
    });
  }
});

// server/routes/ytmusic.ts
import { Router as Router10 } from "express";
var ytmusicRouter, deviceSessions;
var init_ytmusic = __esm({
  "server/routes/ytmusic.ts"() {
    init_youtubeMusic();
    init_songs();
    ytmusicRouter = Router10();
    ytmusicRouter.get("/", (req, res) => {
      res.json({
        name: "Celestial Pure YouTube API",
        version: "1.0.0",
        description: "High-speed pure YouTube REST API with full metadata, search, charts, and streaming.",
        status: "operational",
        provider: "Pure YouTube API (Innertube Engine)",
        endpoints: {
          documentation: "GET /api/ytmusic",
          search: "GET /api/ytmusic/search?q={query}&type={songs|albums|artists|playlists|all}",
          home: "GET /api/ytmusic/home",
          trending: "GET /api/ytmusic/trending",
          song: "GET /api/ytmusic/song/:id",
          album: "GET /api/ytmusic/album/:id",
          artist: "GET /api/ytmusic/artist/:id",
          playlist: "GET /api/ytmusic/playlist/:id",
          lyrics: "GET /api/ytmusic/lyrics/:id?title=...&artist=...",
          queue: "GET /api/ytmusic/queue/:id",
          stream: "GET /api/ytmusic/stream/:id",
          audio: "GET /api/ytmusic/audio/:id"
        }
      });
    });
    ytmusicRouter.get("/search", async (req, res) => {
      const query = String(req.query.q || req.query.query || "").trim();
      const filter = String(req.query.type || req.query.filter || "all").toLowerCase();
      if (!query) {
        return res.json({
          query: "",
          filter,
          songs: [],
          albums: [],
          artists: [],
          playlists: []
        });
      }
      try {
        const results = await youtubeMusicService.search(query, filter);
        res.json({
          query,
          filter,
          ...results
        });
      } catch (err) {
        console.error("[YTMusic API] Search error:", err?.message || err);
        res.status(500).json({ error: "Search failed", details: err?.message });
      }
    });
    ytmusicRouter.get("/home", async (req, res) => {
      try {
        const homeData = await youtubeMusicService.getHome();
        res.json(homeData);
      } catch (err) {
        console.error("[YTMusic API] Home feed error:", err?.message || err);
        res.status(500).json({ error: "Failed to load home feed", details: err?.message });
      }
    });
    ytmusicRouter.get("/trending", async (req, res) => {
      try {
        const searchData = await youtubeMusicService.search("trending hits global top", "songs");
        res.json({
          trending: searchData.songs || []
        });
      } catch (err) {
        console.error("[YTMusic API] Trending error:", err?.message || err);
        res.status(500).json({ error: "Failed to load trending music", details: err?.message });
      }
    });
    ytmusicRouter.get("/song/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const song = await youtubeMusicService.getSong(id);
        if (!song) {
          return res.status(404).json({ error: "Song not found" });
        }
        res.json(song);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch song details", details: err?.message });
      }
    });
    ytmusicRouter.get("/album/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const album = await youtubeMusicService.getAlbum(id);
        if (!album) {
          return res.status(404).json({ error: "Album not found" });
        }
        res.json(album);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch album", details: err?.message });
      }
    });
    ytmusicRouter.get("/artist/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const artist = await youtubeMusicService.getArtist(id);
        if (!artist) {
          return res.status(404).json({ error: "Artist not found" });
        }
        res.json(artist);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch artist", details: err?.message });
      }
    });
    ytmusicRouter.get("/playlist/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const playlist = await youtubeMusicService.getPlaylist(id);
        if (!playlist) {
          return res.status(404).json({ error: "Playlist not found" });
        }
        res.json(playlist);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch playlist", details: err?.message });
      }
    });
    ytmusicRouter.get("/lyrics/:id", async (req, res) => {
      const { id } = req.params;
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      const duration = parseInt(String(req.query.duration || "0"), 10) || void 0;
      try {
        const lyrics = await youtubeMusicService.getLyrics(id, { title, artist, duration });
        if (!lyrics) {
          return res.status(404).json({ error: "Lyrics not found" });
        }
        res.json(lyrics);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch lyrics", details: err?.message });
      }
    });
    ytmusicRouter.get("/queue/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const queue = await youtubeMusicService.getQueue(id);
        res.json({
          songId: id,
          queue: queue || []
        });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch radio queue", details: err?.message });
      }
    });
    ytmusicRouter.get("/stream/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const stream = await youtubeMusicService.getStream(id);
        res.json({
          songId: id,
          ...stream
        });
      } catch (err) {
        res.status(503).json({ error: "Playback stream unavailable", details: err?.message });
      }
    });
    ytmusicRouter.get("/audio/:id", handleAudioStreamProxy);
    deviceSessions = /* @__PURE__ */ new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [code, session] of deviceSessions.entries()) {
        if (now - session.createdAt > 30 * 60 * 1e3) {
          deviceSessions.delete(code);
        }
      }
    }, 5 * 60 * 1e3);
    ytmusicRouter.post("/auth/device-code", async (req, res) => {
      try {
        const { Innertube: Innertube2 } = await import("youtubei.js");
        const tvClient = await Innertube2.create({ client_type: "TV" });
        const clientId = await tvClient.session.oauth.getClientID();
        tvClient.session.oauth.client_id = clientId;
        const codeData = await tvClient.session.oauth.getDeviceAndUserCode();
        deviceSessions.set(codeData.device_code, {
          client_id: clientId,
          tvClient,
          status: "pending",
          createdAt: Date.now()
        });
        const verification_url = codeData.verification_url || "https://www.google.com/device";
        const prefilled_url = `${verification_url}?user_code=${encodeURIComponent(codeData.user_code)}`;
        res.json({
          user_code: codeData.user_code,
          verification_url,
          prefilled_url,
          device_code: codeData.device_code,
          expires_in: codeData.expires_in,
          interval: codeData.interval || 5
        });
      } catch (err) {
        console.error("[Device Code Error]:", err?.message || err);
        res.status(500).json({ error: err?.message || "Failed to start Google sign-in" });
      }
    });
    ytmusicRouter.get("/auth/device-poll", async (req, res) => {
      const deviceCode = String(req.query.code || req.query.device_code || "").trim();
      if (!deviceCode) {
        return res.status(400).json({ error: "Missing device code" });
      }
      const session = deviceSessions.get(deviceCode);
      if (!session) {
        return res.status(404).json({ status: "expired", error: "Session expired or not found" });
      }
      if (session.status === "authenticated" && session.user) {
        return res.json({ status: "authenticated", user: session.user, tokens: session.tokens });
      }
      try {
        const payload = {
          client_id: session.client_id.client_id,
          client_secret: session.client_id.client_secret,
          code: deviceCode,
          grant_type: "http://oauth.net/grant_type/device/1.0"
        };
        const tokenRes = await fetch("https://www.youtube.com/o/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
          if (tokenData.error === "authorization_pending") {
            return res.json({ status: "pending" });
          }
          if (tokenData.error === "slow_down") {
            return res.json({ status: "slow_down" });
          }
          if (tokenData.error === "expired_token") {
            session.status = "expired";
            return res.json({ status: "expired" });
          }
          if (tokenData.error === "access_denied") {
            session.status = "denied";
            return res.json({ status: "denied" });
          }
          return res.json({ status: "error", error: tokenData.error_description || tokenData.error });
        }
        if (tokenData.access_token) {
          let userProfile = null;
          let accountName = "YouTube Music User";
          let avatar = null;
          let email = null;
          let likedSongs = [];
          try {
            if (session.tvClient) {
              session.tvClient.session.oauth.setTokens(tokenData);
              const accountInfo = await session.tvClient.account.getInfo().catch(() => null);
              if (accountInfo?.contents?.[0]) {
                const acc = accountInfo.contents[0];
                accountName = acc.account_name?.text || accountName;
                avatar = acc.account_photo?.[0]?.url || avatar;
                email = acc.email?.text || email;
              }
              const lm = await session.tvClient.getPlaylist("LM").catch(() => null);
              if (lm && Array.isArray(lm.videos)) {
                likedSongs = lm.videos.slice(0, 50).map((v) => ({
                  id: v.id,
                  title: v.title?.text || "Liked Song",
                  artist: v.author?.name || "Artist",
                  album: "YouTube Liked Songs",
                  artworkUrl: v.thumbnails?.[0]?.url || avatar,
                  duration: v.duration?.seconds || 210,
                  streamUrl: `/api/song/${v.id}/audio`
                }));
              }
            }
          } catch (err) {
            console.warn("Account details extraction error:", err?.message);
          }
          if (!email) {
            try {
              const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
              });
              if (userRes.ok) {
                userProfile = await userRes.json();
                if (userProfile.name) accountName = userProfile.name;
                if (userProfile.picture) avatar = userProfile.picture;
                if (userProfile.email) email = userProfile.email;
              }
            } catch {
            }
          }
          const uid = `yt_${userProfile?.sub || Date.now().toString(36)}`;
          const user = {
            uid,
            displayName: accountName,
            email: email || `${accountName.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`,
            photoURL: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(accountName)}`,
            handle: email ? `@${email.split("@")[0]}` : `@${accountName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
            isRealAccount: true
          };
          session.status = "authenticated";
          session.tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in
          };
          session.user = user;
          return res.json({
            status: "authenticated",
            tokens: session.tokens,
            user,
            likedSongs
          });
        }
        return res.json({ status: "pending" });
      } catch (err) {
        res.status(500).json({ error: err?.message || "Poll failed" });
      }
    });
    ytmusicRouter.post("/auth/connect-channel", async (req, res) => {
      const query = String(req.body.query || req.body.handle || "").trim();
      if (!query) {
        return res.status(400).json({ error: "Please enter a YouTube handle (@username) or channel link" });
      }
      try {
        const yt = await youtubeMusicService.getInnertube();
        if (!yt) return res.status(503).json({ error: "YouTube engine unavailable" });
        let channelId = null;
        let title = "";
        let avatar = null;
        let handle = "";
        let subscribers = "";
        if (query.startsWith("UC") && query.length >= 20) {
          channelId = query;
        }
        const cleanSearchQuery = query.replace(/^https?:\/\/(www\.)?youtube\.com\//, "").replace(/^@/, "");
        const searchRes = await yt.search(cleanSearchQuery, { type: "channel" }).catch(() => null);
        const topChannel = searchRes?.channels?.[0];
        if (topChannel) {
          channelId = topChannel.id || channelId;
          title = topChannel.author?.name || cleanSearchQuery;
          avatar = topChannel.author?.thumbnails?.[0]?.url || null;
          handle = topChannel.subscriber_count?.text?.startsWith("@") ? topChannel.subscriber_count.text : `@${cleanSearchQuery}`;
          subscribers = topChannel.video_count?.text || "";
        } else if (channelId) {
          const channel = await yt.getChannel(channelId).catch(() => null);
          title = channel?.metadata?.title || "YouTube Channel";
          avatar = channel?.metadata?.avatar?.[0]?.url || null;
          handle = `@${title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        }
        if (!channelId && !title) {
          return res.status(404).json({ error: `Could not find YouTube channel for "${query}". Try searching by name or handle.` });
        }
        const user = {
          uid: `yt_ch_${channelId || Date.now().toString(36)}`,
          displayName: title,
          photoURL: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title)}`,
          handle: handle.startsWith("@") ? handle : `@${handle}`,
          channelId,
          subscribers,
          isRealAccount: true
        };
        res.json({
          success: true,
          user
        });
      } catch (err) {
        console.error("[Connect Channel Error]:", err?.message || err);
        res.status(500).json({ error: err?.message || "Failed to connect YouTube channel" });
      }
    });
    ytmusicRouter.post("/auth/connect-cookie", async (req, res) => {
      const cookie = String(req.body.cookie || "").trim();
      if (!cookie) {
        return res.status(400).json({ error: "Please provide a valid YouTube Music cookie string" });
      }
      try {
        const { Innertube: Innertube2 } = await import("youtubei.js");
        const userYt = await Innertube2.create({ cookie });
        let accountInfo = null;
        try {
          accountInfo = await userYt.account.getInfo();
        } catch {
        }
        const name = accountInfo?.contents?.[0]?.account_name?.text || "YouTube Music Account";
        const avatar = accountInfo?.contents?.[0]?.account_photo?.[0]?.url || null;
        const email = accountInfo?.contents?.[0]?.email?.text || null;
        let likedSongs = [];
        try {
          const lm = await userYt.getPlaylist("LM");
          if (lm && Array.isArray(lm.videos)) {
            likedSongs = lm.videos.slice(0, 50).map((v) => ({
              id: v.id,
              title: v.title?.text || "Liked Song",
              artist: v.author?.name || "Artist",
              album: "YouTube Liked Songs",
              artworkUrl: v.thumbnails?.[0]?.url || avatar,
              duration: v.duration?.seconds || 210,
              streamUrl: `/api/song/${v.id}/audio`
            }));
          }
        } catch {
        }
        const user = {
          uid: `yt_cookie_${Date.now().toString(36)}`,
          displayName: name,
          photoURL: avatar,
          email,
          handle: email ? `@${email.split("@")[0]}` : "@ytmusic_user"
        };
        res.json({
          success: true,
          user,
          likedSongs
        });
      } catch (err) {
        console.error("[Connect Cookie Error]:", err?.message || err);
        res.status(500).json({ error: err?.message || "Invalid or expired YouTube Music cookie" });
      }
    });
  }
});

// server/routes/spotify.ts
import { Router as Router11 } from "express";
function extractSpotifyIdAndType(input) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/i);
  if (urlMatch) {
    return { type: urlMatch[1].toLowerCase(), id: urlMatch[2] };
  }
  const uriMatch = trimmed.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/i);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  }
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return { type: "playlist", id: trimmed };
  }
  return null;
}
async function fetchPublicSpotifyPlaylist(urlOrId) {
  const parsed = extractSpotifyIdAndType(urlOrId);
  if (!parsed) {
    throw new Error("Please provide a valid Spotify playlist or album URL/URI (e.g. https://open.spotify.com/playlist/...)");
  }
  const { id, type } = parsed;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) {
    throw new Error(`Spotify server returned status ${res.status}. Please check if the playlist is public.`);
  }
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Unable to extract Spotify metadata. The link might be private or unavailable.");
  }
  let json;
  try {
    json = JSON.parse(match[1]);
  } catch (err) {
    throw new Error("Failed to parse Spotify playlist payload: " + err.message);
  }
  const entity = json.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error("Spotify playlist not found or has no tracks.");
  }
  const title = entity.title || entity.name || "Spotify Playlist";
  const description = entity.subtitle || entity.description || `Imported from Spotify (${type === "album" ? "Album" : "Playlist"})`;
  const rawTracks = Array.isArray(entity.trackList) ? entity.trackList : [];
  const trackItems = rawTracks.map((t, index) => {
    const rawTrackId = t.uri ? t.uri.replace("spotify:track:", "") : `track_${index}`;
    const artist = t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a) => a.name).join(", ") : "") || "Unknown Artist";
    const trackTitle = t.title || t.name || "Untitled Track";
    return {
      id: `sp_${rawTrackId}`,
      rawTrackId,
      title: trackTitle,
      artist,
      durationSec: Math.round((Number(t.duration) || 0) / 1e3) || 200,
      spotifyArt: t.coverArt?.sources?.[0]?.url,
      audioPreviewUrl: t.audioPreview?.url
    };
  });
  const resolvedMap = await batchResolveArtworks(trackItems);
  let initialCover = entity.coverArt?.sources?.[0]?.url || entity.visualIdentity?.image?.[0]?.url;
  const tracks = trackItems.map((item) => {
    const resolvedArt = resolvedMap.get(item.id);
    const trackArt = item.spotifyArt || resolvedArt || initialCover || "";
    if (!initialCover && resolvedArt) {
      initialCover = resolvedArt;
    }
    return {
      id: item.id,
      spotifyId: item.rawTrackId,
      title: item.title,
      artist: item.artist,
      album: title,
      artworkUrl: trackArt,
      duration: item.durationSec,
      source: "spotify",
      audioPreviewUrl: item.audioPreviewUrl
    };
  });
  const finalCoverUrl = initialCover || tracks[0]?.artworkUrl || "";
  return {
    id,
    type,
    title,
    description,
    artworkUrl: finalCoverUrl,
    trackCount: tracks.length,
    tracks
  };
}
function generateSpotifyAuthUrl() {
  const state = Buffer.from(
    JSON.stringify({
      csrf: Math.random().toString(36).substring(2),
      timestamp: Date.now()
    })
  ).toString("base64");
  return SPOTIFY_AUTHORIZE_URL + "?client_id=" + encodeURIComponent(spotifyClientId) + "&response_type=code&redirect_uri=" + encodeURIComponent(spotifyRedirectUri) + "&scope=" + encodeURIComponent(SPOTIFY_SCOPES) + "&state=" + state + "&show_dialog=true";
}
async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: spotifyRedirectUri
  });
  const auth = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`, "utf8").toString("base64");
  const tokenRes = await fetch(`${SPOTIFY_API_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`
    },
    body
  });
  if (!tokenRes.ok) {
    throw new Error("Failed to exchange code for token");
  }
  return tokenRes.json();
}
var spotifyClientId, spotifyClientSecret, spotifyRedirectUri, SPOTIFY_AUTHORIZE_URL, SPOTIFY_API_BASE, SPOTIFY_SCOPES, CURATED_SPOTIFY_PLAYLISTS, spotifyRouter;
var init_spotify = __esm({
  "server/routes/spotify.ts"() {
    init_thumbnailResolver();
    spotifyClientId = process.env.SPOTIFY_CLIENT_ID || "";
    spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
    spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/spotify/callback";
    SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
    SPOTIFY_API_BASE = "https://api.spotify.com/v1";
    SPOTIFY_SCOPES = "user-read-email user-read-playlist-read playlist-read-collaborative playlist-read-private";
    CURATED_SPOTIFY_PLAYLISTS = [
      {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        type: "playlist",
        title: "Today's Top Hits",
        description: "The biggest hits right now across pop, dance and hip-hop.",
        artworkUrl: "https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b",
        trackCount: 50
      },
      {
        id: "37i9dQZF1DX0XUsuxWHRQd",
        type: "playlist",
        title: "RapCaviar",
        description: "New music from Drake, Kendrick Lamar, Future and hip-hop icons.",
        artworkUrl: "https://i.scdn.co/image/ab67706f00000002882f0fa3c1bf367ff122e283",
        trackCount: 50
      },
      {
        id: "37i9dQZF1DX4o1oenSJRJd",
        type: "playlist",
        title: "All Out 2000s",
        description: "The biggest and most memorable songs of the 2000s.",
        artworkUrl: "https://i.scdn.co/image/ab67706f00000002b54203df569c73b06bc91d29",
        trackCount: 50
      },
      {
        id: "37i9dQZF1DXdLEN7aqioXM",
        type: "playlist",
        title: "Lo-Fi Beats",
        description: "Chill beats, instrumental vibes and lo-fi melodies for focus.",
        artworkUrl: "https://i.scdn.co/image/ab67706f0000000254473de87526aec8577239ef",
        trackCount: 50
      },
      {
        id: "37i9dQZF1DWUa8ZRTfalHk",
        type: "playlist",
        title: "Pop Rising",
        description: "The next generation of pop music superstars.",
        artworkUrl: "https://i.scdn.co/image/ab67706f000000028e370a25695669b91ad8ee64",
        trackCount: 50
      },
      {
        id: "37i9dQZF1DWZeKCadgRdKQ",
        type: "playlist",
        title: "Deep Focus",
        description: "Ambient atmospheric soundscapes for deep flow states.",
        artworkUrl: "https://i.scdn.co/image/ab67706f00000002d073e6f3e5cbd79ea7472123",
        trackCount: 50
      }
    ];
    spotifyRouter = Router11();
    spotifyRouter.get("/playlist", async (req, res) => {
      const urlOrId = req.query.url || req.query.id || "";
      if (!urlOrId) {
        return res.status(400).json({
          error: 'Please provide a "url" or "id" query parameter with a Spotify playlist or album link.'
        });
      }
      try {
        const data = await fetchPublicSpotifyPlaylist(urlOrId);
        res.json({ success: true, ...data });
      } catch (err) {
        console.error("Spotify playlist fetch error:", err.message);
        res.status(500).json({ error: err.message || "Failed to fetch Spotify playlist" });
      }
    });
    spotifyRouter.get("/featured", (_req, res) => {
      res.json({ success: true, playlists: CURATED_SPOTIFY_PLAYLISTS });
    });
    spotifyRouter.get("/auth", (req, res) => {
      if (!spotifyClientId) {
        return res.redirect("/?spotify_import=1");
      }
      const authUrl = generateSpotifyAuthUrl();
      res.redirect(authUrl);
    });
    spotifyRouter.get("/callback", async (req, res) => {
      const code = req.query.code;
      if (!code) {
        return res.status(400).json({ error: "No authorization code provided" });
      }
      try {
        const tokenData = await exchangeCodeForToken(code);
        res.send(`
      <html>
        <body style="background:#09090b;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#1DB954;">Spotify Connected Successfully!</h2>
          <p>Closing window and returning to Celestial Music...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', token: ${JSON.stringify(tokenData.access_token)} }, '*');
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
      } catch (err) {
        console.error("Spotify OAuth callback error:", err.message);
        res.status(500).json({ error: "Failed to exchange authorization code", details: err.message });
      }
    });
    spotifyRouter.get("/playlists", async (req, res) => {
      const accessToken = req.query.access_token;
      if (!accessToken) {
        return res.status(401).json({ error: "No access token provided" });
      }
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const playlistsRes = await fetch(`${SPOTIFY_API_BASE}/me/playlists?limit=50`, { headers });
        if (!playlistsRes.ok) {
          throw new Error(`Failed to fetch playlists (status: ${playlistsRes.status})`);
        }
        const data = await playlistsRes.json();
        res.json({ success: true, playlists: data });
      } catch (err) {
        console.error("Spotify playlists fetch error:", err.message);
        res.status(500).json({ error: "Failed to fetch Spotify playlists", details: err.message });
      }
    });
  }
});

// server/index.ts
var index_exports = {};
__export(index_exports, {
  apiRouter: () => apiRouter
});
import { Router as Router12 } from "express";
var apiRouter;
var init_index = __esm({
  "server/index.ts"() {
    init_home();
    init_search();
    init_songs();
    init_albums();
    init_artists();
    init_playlists();
    init_lyrics();
    init_queue();
    init_imageProxy();
    init_ytmusic();
    init_spotify();
    init_youtubeMusic();
    if (!process.env.VERCEL) {
      youtubeMusicService.getInnertube().catch(() => {
      });
    }
    apiRouter = Router12();
    apiRouter.use("/spotify", spotifyRouter);
    apiRouter.use("/spotify-auth", spotifyRouter);
    apiRouter.use("/ytmusic", ytmusicRouter);
    apiRouter.use("/youtube-music", ytmusicRouter);
    apiRouter.use("/youtube", ytmusicRouter);
    apiRouter.use("/home", homeRouter);
    apiRouter.use("/search", searchRouter);
    apiRouter.use("/song", songsRouter);
    apiRouter.use("/songs", songsRouter);
    apiRouter.use("/album", albumsRouter);
    apiRouter.use("/albums", albumsRouter);
    apiRouter.use("/artist", artistsRouter);
    apiRouter.use("/artists", artistsRouter);
    apiRouter.use("/playlist", playlistsRouter);
    apiRouter.use("/playlists", playlistsRouter);
    apiRouter.use("/lyrics", lyricsRouter);
    apiRouter.use("/queue", queueRouter);
    apiRouter.use("/image-proxy", imageProxyRouter);
    apiRouter.use("/proxy-image", imageProxyRouter);
    apiRouter.get("/stream", handleAudioStreamProxy);
    apiRouter.get("/stream/:id/audio", handleAudioStreamProxy);
    apiRouter.get("/music/stream", handleAudioStreamProxy);
    apiRouter.get("/stream/:id", async (req, res) => {
      const { id } = req.params;
      const title = String(req.query.title || "");
      const artist = String(req.query.artist || "");
      try {
        const stream = await youtubeMusicService.getStream(id, { title, artist });
        res.json(stream);
      } catch (err) {
        res.status(503).json({ error: "Playback stream unavailable" });
      }
    });
    apiRouter.get("/health", (req, res) => {
      res.json({
        status: "ok",
        provider: "youtube",
        timestamp: Date.now()
      });
    });
  }
});

// server/api-entry.ts
import express from "express";
var appPromise = null;
async function createApp() {
  const { apiRouter: apiRouter2 } = await Promise.resolve().then(() => (init_index(), index_exports));
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.get("/api/status", (_req, res) => {
    res.json({
      provider: "YouTube Music (youtubei.js)",
      requiresApiKey: false,
      status: "operational",
      platform: "Vercel Serverless Function"
    });
  });
  app.use("/api/music", apiRouter2);
  app.use("/api", apiRouter2);
  app.use("/music", apiRouter2);
  app.use("/", apiRouter2);
  return app;
}
function loadApp() {
  if (!appPromise) {
    appPromise = createApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}
async function handler(req, res) {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] failed to start Express app:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Music API failed to start", message }));
    }
  }
}
export {
  handler as default
};
