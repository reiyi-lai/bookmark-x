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

  type TweetsMessage = {
    source: "bookmark-x";
    type: "BX_TWEETS";
    sessionId: string;
    tweets: CollectedTweet[];
    totalUnique: number;
    url: string;
  };

  const post = (msg: StatusMessage | TweetsMessage) => {
    window.postMessage(msg, "*");
  };

  let active = false;
  let sessionId: string | null = null;
  const seenTweetIds = new Set<string>();

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
      const tweet = extractTweetFromResult(tweetResults);
      if (tweet) tweets.push(tweet);

      // Some entries contain modules with nested items
      const moduleItems = entry?.content?.items;
      if (Array.isArray(moduleItems)) {
        for (const mi of moduleItems) {
          const tr = mi?.item?.itemContent?.tweet_results?.result;
          const t = extractTweetFromResult(tr);
          if (t) tweets.push(t);
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

    return tweets;
  }

  function handleCapturedJson(url: string, json: any) {
    if (!active || !sessionId) return;
    if (!json || typeof json !== "object") return;

    const extracted = extractTweetsFromGraphQLPayload(json);
    if (extracted.length === 0) return;

    const newTweets: CollectedTweet[] = [];
    for (const t of extracted) {
      if (!t?.tweetId) continue;
      if (seenTweetIds.has(t.tweetId)) continue;
      seenTweetIds.add(t.tweetId);
      newTweets.push(t);
    }

    if (newTweets.length === 0) return;

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
          .then((json) => handleCapturedJson(String(url), json))
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
        if (!active || !sessionId) return;
        const url = (this as any).__bx_url;
        if (!url || !isBookmarksGraphQLUrl(String(url))) return;

        const text = (this.responseType === "" || this.responseType === "text")
          ? (this.responseText || "")
          : "";
        if (!text) return;

        const json = safeJsonParse(text);
        if (!json) return;
        handleCapturedJson(String(url), json);
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


