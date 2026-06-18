/**
 * Runs in the PAGE context (MAIN world), not the extension/content-script world.
 *
 * Purpose: hook XHR to capture X.com bookmarks timeline GraphQL responses,
 * extract tweet data, and stream it back to the content script via window.postMessage.
 *
 * IMPORTANT:
 * - Do not import anything here. Keep it standalone so Vite outputs a single entry file.
 * - This file is injected via chrome.scripting.executeScript({ world: "MAIN", files: [...] }).
 */
(() => {
  const GLOBAL_KEY = "__BOOKMARK_X_COLLECTOR_INJECTED__";
  if ((window as any)[GLOBAL_KEY]) {
    console.log('Bookmark-X Injection: Already injected, skipping');
    return;
  }
  (window as any)[GLOBAL_KEY] = true;
  console.log('Bookmark-X Injection: Script loaded and running in MAIN world');

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
  let activityInterval: ReturnType<typeof setInterval> | null = null;
  const seenTweetIds = new Set<string>();
  // Buffer a few recent matching payloads so if the page loads bookmarks BEFORE the user hits Sync,
  // we can still process those immediately after BX_COLLECTOR_START.
  const prebuffer: { ts: number; url: string; json: any }[] = [];
  const PREBUFFER_MAX = 10;
  const PREBUFFER_TTL_MS = 15_000;

  const BOOKMARKS_URL_PATTERNS = [
    /\/i\/api\/graphql\/[^/]+\/Bookmarks/i,
    /graphql.*bookmark/i,
  ];

  function isBookmarksGraphQLUrl(url: string): boolean {
    for (const pattern of BOOKMARKS_URL_PATTERNS) {
      if (pattern.test(url)) return true;
    }
    return false;
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

  function extractCursor(payload: any): string | null {
    const timeline =
      pick(payload, ["data", "bookmark_timeline_v2", "timeline"]) ||
      pick(payload, ["data", "bookmark_timeline", "timeline"]) ||
      pick(payload, ["data", "bookmark_timeline_v2"]) ||
      null;
    const instructions: any[] = Array.isArray(timeline?.instructions)
      ? timeline.instructions : [];
    for (const instr of instructions) {
      const entries: any[] = Array.isArray(instr?.entries) ? instr.entries : [];
      for (const entry of entries) {
        if (entry?.content?.cursorType === "Bottom" && entry?.content?.value) {
          return entry.content.value;
        }
        if (entry?.content?.entryType === "TimelineTimelineCursor" &&
            entry?.content?.cursorType === "Bottom") {
          return entry.content.value;
        }
      }
    }
    return null;
  }

  let capturedBaseUrl: string | null = null;
  let capturedFeaturesParam: string | null = null;

  function captureRequestTemplate(url: string) {
    if (capturedBaseUrl) return;
    try {
      const parsed = new URL(url);
      // Store the base path (with query hash) and features param for replaying
      capturedFeaturesParam = parsed.searchParams.get("features");
      // Keep everything except variables (we'll set that per-page)
      parsed.searchParams.delete("variables");
      capturedBaseUrl = parsed.toString();
      console.log("Bookmark-X Injection: Captured request template for direct pagination");
    } catch {}
  }

  function getAuthHeaders(): Record<string, string> {
    const csrfToken =
      document.cookie.match(/ct0=([^;]+)/)?.[1] ||
      (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || "";
    return {
      "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "x-csrf-token": csrfToken,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": navigator.language || "en",
      "content-type": "application/json",
    };
  }

  async function fetchPageDirect(cursor: string): Promise<{ json: any; url: string } | null> {
    if (!capturedBaseUrl) return null;
    try {
      const parsed = new URL(capturedBaseUrl);
      const variables = JSON.stringify({ count: 20, cursor, includePromotedContent: true });
      parsed.searchParams.set("variables", variables);
      if (capturedFeaturesParam) parsed.searchParams.set("features", capturedFeaturesParam);
      const url = parsed.toString();

      const res = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        console.warn(`Bookmark-X Injection: Direct fetch failed: ${res.status}`);
        return null;
      }
      const json = await res.json();
      return { json, url };
    } catch (err) {
      console.error("Bookmark-X Injection: Direct fetch error:", err);
      return null;
    }
  }

  async function runDirectPagination() {
    if (!active || !sessionId || !capturedBaseUrl) return;
    console.log("Bookmark-X Injection: Starting direct cursor pagination");
    let cursor: string | null = null;
    let consecutiveEmpty = 0;
    const MAX_PAGES = 200;
    let page = 0;

    // Get cursor from the most recent captured payload
    for (let i = prebuffer.length - 1; i >= 0; i--) {
      cursor = extractCursor(prebuffer[i].json);
      if (cursor) break;
    }
    if (!cursor) {
      console.log("Bookmark-X Injection: No cursor found, cannot paginate directly");
      return;
    }

    while (active && cursor && page < MAX_PAGES && consecutiveEmpty < 3) {
      const result = await fetchPageDirect(cursor);
      if (!result) { consecutiveEmpty++; continue; }

      onCapturedJson(result.url, result.json);
      const nextCursor = extractCursor(result.json);

      if (!nextCursor || nextCursor === cursor) {
        console.log("Bookmark-X Injection: No more pages (cursor exhausted)");
        break;
      }

      const extracted = extractTweetsFromGraphQLPayload(result.json);
      if (extracted.length === 0) {
        consecutiveEmpty++;
      } else {
        consecutiveEmpty = 0;
      }

      cursor = nextCursor;
      page++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`Bookmark-X Injection: Direct pagination done. ${page} pages fetched.`);
    // Signal content script that pagination is complete
    if (sessionId) {
      window.postMessage({
        source: "bookmark-x",
        type: "BX_PAGINATION_DONE",
        sessionId,
        totalUnique: seenTweetIds.size,
      }, "*");
    }
  }

  function onCapturedJson(url: string, json: any) {
    // Always buffer the most recent payloads (very small ring buffer).
    const now = Date.now();
    prebuffer.push({ ts: now, url, json });
    while (prebuffer.length > PREBUFFER_MAX) prebuffer.shift();
    
    console.log(`Bookmark-X Injection: onCapturedJson called - active: ${active}, sessionId: ${sessionId}, url:`, url.substring(0, 100));

    if (!active || !sessionId) {
      console.log('Bookmark-X Injection: Not active or no sessionId, buffering only');
      return;
    }
    if (!json || typeof json !== "object") {
      console.log('Bookmark-X Injection: Invalid JSON, skipping');
      return;
    }

    const extracted = extractTweetsFromGraphQLPayload(json);
    const extractedCount = extracted.length;
    console.log(`Bookmark-X Injection: Extracted ${extractedCount} tweets from GraphQL payload`);
    
    if (extractedCount === 0) {
      console.log('Bookmark-X Injection: No tweets extracted from this payload');
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

  // Hook XHR — wrap onreadystatechange to read response BEFORE X.com's handler
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  console.log('Bookmark-X Injection: XHR hook installed');

  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
    (this as any).__bx_url = String(url);
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  } as any;

  function tryExtractXhrJson(xhr: XMLHttpRequest): any | null {
    const rt = xhr.responseType;
    const resp = (xhr as any).response;

    // responseType "json" — response is already parsed
    if (resp && typeof resp === "object" && !(resp instanceof ArrayBuffer) && !(resp instanceof Blob)) {
      return resp;
    }
    // Blob response (LinkedIn-style) — read asynchronously
    if (resp instanceof Blob && resp.size > 0) {
      resp.text().then((text: string) => {
        const json = safeJsonParse(text);
        if (json) {
          console.log(`Bookmark-X Injection: ✅ Got JSON from XHR blob (${resp.size} bytes)`);
          onCapturedJson((xhr as any).__bx_url || "", json);
        }
      }).catch(() => {});
      return null; // handled async
    }
    // ArrayBuffer response
    if (resp instanceof ArrayBuffer && resp.byteLength > 0) {
      try {
        const text = new TextDecoder().decode(resp);
        return safeJsonParse(text);
      } catch { return null; }
    }
    // Text response
    const text =
      (rt === "" || rt === "text") ? (xhr.responseText || "") :
      (typeof resp === "string") ? resp : "";
    if (text) return safeJsonParse(text);
    return null;
  }

  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
    const url: string = (this as any).__bx_url || "";
    if (url && isBookmarksGraphQLUrl(url)) {
      const xhr = this;
      // Wrap onreadystatechange to read response BEFORE X.com's handler
      const origOnRSC = xhr.onreadystatechange;
      let captured = false;
      xhr.onreadystatechange = function (ev: Event) {
        if (!captured && xhr.readyState === 4 && xhr.status === 200) {
          captured = true;
          console.log(`Bookmark-X Injection: ✅ XHR Bookmarks readyState=4:`, {
            url: url.substring(0, 150),
            responseType: xhr.responseType,
            responseTextLen: (() => { try { return xhr.responseText.length; } catch { return -1; } })(),
            responseKind: xhr.response === null ? 'null' : xhr.response?.constructor?.name || typeof xhr.response,
            responseSize: xhr.response instanceof Blob ? xhr.response.size :
                          xhr.response instanceof ArrayBuffer ? xhr.response.byteLength :
                          typeof xhr.response === 'string' ? xhr.response.length : '?',
          });
          const json = tryExtractXhrJson(xhr);
          if (json) {
            console.log(`Bookmark-X Injection: ✅ Got JSON from XHR Bookmarks response!`);
            captureRequestTemplate(url);
            onCapturedJson(url, json);
          }
        }
        if (origOnRSC) origOnRSC.call(xhr, ev);
      };
      // Also listen for load event in case onreadystatechange isn't used
      xhr.addEventListener("load", () => {
        if (!captured && xhr.status === 200) {
          captured = true;
          console.log(`Bookmark-X Injection: ✅ XHR Bookmarks load event fallback`);
          const json = tryExtractXhrJson(xhr);
          if (json) onCapturedJson(url, json);
        }
      });
    }
    return (originalSend as any).apply(this, args);
  } as any;

  function setActive(nextActive: boolean, nextSessionId: string) {
    active = nextActive;
    sessionId = nextSessionId;
    console.log(`Bookmark-X Injection: setActive called - active: ${nextActive}, sessionId: ${nextSessionId}`);
    if (active) {
      seenTweetIds.clear();
      // Flush recent buffered payloads immediately on start (best-effort).
      const now = Date.now();
      const recent = prebuffer.filter((p) => now - p.ts <= PREBUFFER_TTL_MS);
      console.log(`Bookmark-X Injection: Flushing ${recent.length} buffered payloads`);
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
    // Don't rely on strict `event.source` equality across isolated/MAIN worlds.
    if (event.origin && event.origin !== window.location.origin) return;
    const data = event.data as StartMessage | StopMessage | any;
    if (!data || data.source !== "bookmark-x") return;

    console.log('Bookmark-X Injection: Received message:', data.type, data);

    if (data.type === "BX_COLLECTOR_START" && typeof data.sessionId === "string") {
      console.log('Bookmark-X Injection: START command received');
      if (activityInterval) clearInterval(activityInterval);
      setActive(true, data.sessionId);

      activityInterval = setInterval(() => {
        if (!active) {
          clearInterval(activityInterval!);
          activityInterval = null;
          return;
        }
        console.log(`Bookmark-X Injection: Network activity - ${seenTweetIds.size} unique tweets collected`);
      }, 3000);

      return;
    }

    if (data.type === "BX_COLLECTOR_FETCH_PAGES" && typeof data.sessionId === "string") {
      console.log("Bookmark-X Injection: FETCH_PAGES command received");
      runDirectPagination();
      return;
    }

    if (data.type === "BX_COLLECTOR_STOP" && typeof data.sessionId === "string") {
      console.log(`Bookmark-X Injection: STOP - ${seenTweetIds.size} unique tweets collected`);
      if (activityInterval) { clearInterval(activityInterval); activityInterval = null; }
      setActive(false, data.sessionId);
      return;
    }
  });
  
  console.log('Bookmark-X Injection: Message listener installed, ready to receive commands');
})();
