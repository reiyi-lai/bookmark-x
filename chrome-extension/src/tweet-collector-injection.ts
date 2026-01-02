/**
 * Runs in the PAGE context (MAIN world), not the extension/content-script world.
 *
 * Purpose: hook fetch/XHR to capture X.com bookmarks timeline GraphQL responses,
 * extract tweet data, and stream it back to the content script via window.postMessage.
 *
 * IMPORTANT:
 * - Do not import anything here. Keep it standalone so Vite outputs a single entry file.
 * - This file is injected via chrome.scripting.executeScript({ world: "MAIN", files: [...] }).
 */
(() => {
  const GLOBAL_KEY = "__BOOKMARK_X_COLLECTOR_INJECTED__";
  if ((window as any)[GLOBAL_KEY]) return;
  (window as any)[GLOBAL_KEY] = true;

  type CollectedTweet = {
    tweetId: string;
    tweetUrl: string;
    authorName: string;
    handle: string;
    tweetText: string;
    time: string;
    profilePicture: string;
    media: "has_media" | null;
  };

  type StartMessage = {
    source: "bookmark-x";
    type: "BX_COLLECTOR_START";
    sessionId: string;
  };

  type StopMessage = {
    source: "bookmark-x";
    type: "BX_COLLECTOR_STOP";
    sessionId: string;
  };

  type StatusMessage = {
    source: "bookmark-x";
    type: "BX_COLLECTOR_STATUS";
    sessionId: string;
    active: boolean;
    totalUnique: number;
  };

  type CaptureMessage = {
    source: "bookmark-x";
    type: "BX_COLLECTOR_CAPTURE";
    sessionId: string;
    url: string;
    extracted: number; // tweets extracted from this payload (before dedupe)
    newUnique: number; // new unique tweets added from this payload
    totalUnique: number;
  };

  type TweetsMessage = {
    source: "bookmark-x";
    type: "BX_TWEETS";
    sessionId: string;
    tweets: CollectedTweet[];
    totalUnique: number;
    url: string;
  };

  const post = (msg: StatusMessage | TweetsMessage | CaptureMessage) => {
    window.postMessage(msg, "*");
  };

  let active = false;
  let sessionId: string | null = null;
  const seenTweetIds = new Set<string>();
  // Buffer a few recent matching payloads so if the page loads bookmarks BEFORE the user hits Sync,
  // we can still process those immediately after BX_COLLECTOR_START.
  const prebuffer: { ts: number; url: string; json: any }[] = [];
  const PREBUFFER_MAX = 10;
  const PREBUFFER_TTL_MS = 15_000;

  const BOOKMARKS_URL_RE = /\/i\/api\/graphql\/[^/]+\/Bookmarks/i;

  function isBookmarksGraphQLUrl(url: string): boolean {
    // X usually uses: https://x.com/i/api/graphql/<hash>/Bookmarks?... for the bookmarks timeline.
    if (BOOKMARKS_URL_RE.test(url)) return true;
    // Fallback: be conservative but allow other "Bookmarks" operations if naming differs.
    return url.includes("/i/api/graphql/") && /Bookmarks/i.test(url);
  }

  function safeJsonParse(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function pick(obj: any, path: (string | number)[]): any {
    let cur = obj;
    for (const key of path) {
      if (!cur) return undefined;
      cur = cur[key as any];
    }
    return cur;
  }

  function normalizeTweetResult(result: any): any | null {
    if (!result) return null;
    // Sometimes nested under TweetWithVisibilityResults
    if (result.tweet) return result.tweet;
    return result;
  }

  function extractTweetFromResult(result: any): CollectedTweet | null {
    const normalized = normalizeTweetResult(result);
    if (!normalized) return null;

    const tweetId: string | undefined =
      normalized.rest_id ||
      pick(normalized, ["legacy", "id_str"]) ||
      pick(normalized, ["tweet", "rest_id"]);
    if (!tweetId) return null;

    const legacy = normalized.legacy || pick(normalized, ["tweet", "legacy"]) || {};
    const fullText: string =
      (legacy.full_text || legacy.text || "").toString().trim();

    const createdAt: string = (legacy.created_at || "").toString();

    const userResult =
      pick(normalized, ["core", "user_results", "result"]) ||
      pick(normalized, ["tweet", "core", "user_results", "result"]) ||
      {};
    const userLegacy = userResult.legacy || {};
    const handle: string = (userLegacy.screen_name || "").toString();
    const authorName: string = (userLegacy.name || "").toString();
    const profilePicture: string =
      (userLegacy.profile_image_url_https || userLegacy.profile_image_url || "").toString();

    const mediaEntities =
      pick(legacy, ["extended_entities", "media"]) ||
      pick(legacy, ["entities", "media"]) ||
      null;
    const hasMedia = Array.isArray(mediaEntities) && mediaEntities.length > 0;

    // Allow media-only bookmarks too.
    const tweetText = fullText || (hasMedia ? "[Media-only bookmark]" : "");
    if (!tweetText) return null;

    const tweetUrl =
      handle ? `https://x.com/${handle}/status/${tweetId}` : `https://x.com/i/web/status/${tweetId}`;

    return {
      tweetId,
      tweetUrl,
      authorName,
      handle,
      tweetText,
      time: createdAt,
      profilePicture,
      media: hasMedia ? "has_media" : null,
    };
  }

  function extractTweetsFromGraphQLPayload(payload: any): CollectedTweet[] {
    const tweets: CollectedTweet[] = [];
    const seenLocal = new Set<string>();

    const pushTweet = (t: CollectedTweet | null) => {
      if (!t?.tweetId) return;
      if (seenLocal.has(t.tweetId)) return;
      seenLocal.add(t.tweetId);
      tweets.push(t);
    };

    const timeline =
      pick(payload, ["data", "bookmark_timeline_v2", "timeline"]) ||
      pick(payload, ["data", "bookmark_timeline", "timeline"]) ||
      pick(payload, ["data", "bookmark_timeline_v2"]) ||
      null;

    const instructions: any[] = Array.isArray(timeline?.instructions)
      ? timeline.instructions
      : [];

    const visitEntry = (entry: any) => {
      const itemContent = entry?.content?.itemContent;
      const tweetResults = itemContent?.tweet_results?.result;
      pushTweet(extractTweetFromResult(tweetResults));

      // Some entries contain modules with nested items
      const moduleItems = entry?.content?.items;
      if (Array.isArray(moduleItems)) {
        for (const mi of moduleItems) {
          const tr = mi?.item?.itemContent?.tweet_results?.result;
          pushTweet(extractTweetFromResult(tr));
        }
      }
    };

    for (const instr of instructions) {
      const entries: any[] =
        (Array.isArray(instr?.entries) && instr.entries) ||
        (Array.isArray(instr?.entry?.entries) && instr.entry.entries) ||
        [];

      for (const entry of entries) visitEntry(entry);
    }

    // Fallback: schema-agnostic deep scan for tweet_results anywhere in the payload.
    // This is resilient to X schema changes and A/B tests.
    if (tweets.length === 0) {
      const MAX_NODES = 50_000;
      let visited = 0;

      const walk = (node: any) => {
        if (!node || visited >= MAX_NODES) return;
        visited++;

        if (Array.isArray(node)) {
          for (const item of node) walk(item);
          return;
        }

        if (typeof node !== "object") return;

        if ((node as any).tweet_results?.result) {
          pushTweet(extractTweetFromResult((node as any).tweet_results.result));
        }
        if ((node as any).itemContent?.tweet_results?.result) {
          pushTweet(extractTweetFromResult((node as any).itemContent.tweet_results.result));
        }

        for (const v of Object.values(node)) walk(v);
      };

      walk(payload);
    }

    return tweets;
  }

  function onCapturedJson(url: string, json: any) {
    // Always buffer the most recent payloads (very small ring buffer).
    const now = Date.now();
    prebuffer.push({ ts: now, url, json });
    while (prebuffer.length > PREBUFFER_MAX) prebuffer.shift();

    if (!active || !sessionId) return;
    if (!json || typeof json !== "object") return;

    const extracted = extractTweetsFromGraphQLPayload(json);
    const extractedCount = extracted.length;
    if (extractedCount === 0) {
      post({
        source: "bookmark-x",
        type: "BX_COLLECTOR_CAPTURE",
        sessionId,
        url,
        extracted: 0,
        newUnique: 0,
        totalUnique: seenTweetIds.size,
      });
      return;
    }

    const newTweets: CollectedTweet[] = [];
    for (const t of extracted) {
      if (!t?.tweetId) continue;
      if (seenTweetIds.has(t.tweetId)) continue;
      seenTweetIds.add(t.tweetId);
      newTweets.push(t);
    }

    if (newTweets.length === 0) return;

    post({
      source: "bookmark-x",
      type: "BX_COLLECTOR_CAPTURE",
      sessionId,
      url,
      extracted: extractedCount,
      newUnique: newTweets.length,
      totalUnique: seenTweetIds.size,
    });

    // Send in manageable batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < newTweets.length; i += BATCH_SIZE) {
      const batch = newTweets.slice(i, i + BATCH_SIZE);
      post({
        source: "bookmark-x",
        type: "BX_TWEETS",
        sessionId,
        tweets: batch,
        totalUnique: seenTweetIds.size,
        url,
      });
    }
  }

  // Hook fetch
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: any[]) => {
    // Avoid TS spread-arg issues by calling with explicit parameters.
    const res = await originalFetch(args[0] as any, args[1] as any);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (active && sessionId && url && isBookmarksGraphQLUrl(url)) {
        const cloned = res.clone();
        // Process async so we never block the page response.
        Promise.resolve()
          .then(() => cloned.json())
          .then((json) => onCapturedJson(String(url), json))
          .catch(() => {
            // ignore parse errors
          });
      }
    } catch {
      // ignore
    }
    return res;
  };

  // Hook XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string, ...rest: any[]) {
    (this as any).__bx_url = url;
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  } as any;

  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
    this.addEventListener("loadend", () => {
      try {
        const url = (this as any).__bx_url;
        if (!url || !isBookmarksGraphQLUrl(String(url))) return;

        // XHR may use responseType="json", in which case responseText is empty.
        const rt = this.responseType;
        let json: any | null = null;

        if (rt === "json") {
          const resp = (this as any).response;
          if (resp && typeof resp === "object") json = resp;
        } else {
          const text =
            rt === "" || rt === "text"
              ? (this.responseText || "")
              : (typeof (this as any).response === "string" ? (this as any).response : "");
          if (text) json = safeJsonParse(text);
        }

        if (!json) return;
        onCapturedJson(String(url), json);
      } catch {
        // ignore
      }
    });
    return (originalSend as any).apply(this, args);
  } as any;

  function setActive(nextActive: boolean, nextSessionId: string) {
    active = nextActive;
    sessionId = nextSessionId;
    if (active) {
      seenTweetIds.clear();
      // Flush recent buffered payloads immediately on start (best-effort).
      const now = Date.now();
      const recent = prebuffer.filter((p) => now - p.ts <= PREBUFFER_TTL_MS);
      for (const p of recent) {
        try {
          onCapturedJson(p.url, p.json);
        } catch {
          // ignore
        }
      }
    }
    post({
      source: "bookmark-x",
      type: "BX_COLLECTOR_STATUS",
      sessionId: nextSessionId,
      active,
      totalUnique: seenTweetIds.size,
    });
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as StartMessage | StopMessage | any;
    if (!data || data.source !== "bookmark-x") return;

    if (data.type === "BX_COLLECTOR_START" && typeof data.sessionId === "string") {
      setActive(true, data.sessionId);
      return;
    }

    if (data.type === "BX_COLLECTOR_STOP" && typeof data.sessionId === "string") {
      setActive(false, data.sessionId);
      return;
    }
  });
})();
