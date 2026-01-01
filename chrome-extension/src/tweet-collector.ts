import { CollectedTweet as Tweet } from '../../shared/schema';
import { TweetCarousel, createLoadingModal } from './components/modal';
import { showNotification } from './components/sync-button';

type InjectStatusMessage =
  | { source: 'bookmark-x'; type: 'BX_COLLECTOR_STATUS'; sessionId: string; active: boolean; totalUnique: number }
  | { source: 'bookmark-x'; type: 'BX_TWEETS'; sessionId: string; tweets: Tweet[]; totalUnique: number; url: string };

// Extract Twitter user info from the page DOM
export async function getTwitterUserInfo(): Promise<{ id: string; username: string } | null> {
  try {
    // Look for initial state data in script tags
    const scripts = Array.from(document.getElementsByTagName('script'));
    const stateScript = scripts.find(s => s.textContent?.includes('"screen_name"'));
    
    if (stateScript?.textContent) {
      // Extract both username and ID using a single regex
      const match = stateScript.textContent.match(/"screen_name":"([^"]+)".+"id_str":"(\d+)"/);
      if (match) {
        const userInfo = {
          username: match[1],
          id: match[2]
        };
        
        return userInfo;
      }
    }

    console.warn('Bookmark-X: Could not find Twitter user info in initial state');
    return null;

  } catch (error) {
    console.error('Bookmark-X: Error getting Twitter user info:', error);
    return null;
  }
}

// Extract profile picture URL from twitter handle for speed
function extractProfilePicture(tweetElement: Element): string {
  try {
    const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
    if (linkElement?.href) {
      const handle = linkElement.href.split('/').pop();
      return `https://unavatar.io/twitter/${handle}`
    }
  } catch (error) {
    // Silent fallback
  }
  
  return '';
}

function getScrollContainer(): HTMLElement {
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

async function ensureNetworkCollectorInjected(): Promise<boolean> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'INJECT_TWEET_COLLECTOR' });
    return !!resp?.success;
  } catch (e) {
    console.warn('Bookmark-X: Failed to request injector:', e);
    return false;
  }
}

async function collectWithNetworkCapture(
  onTweetCollected?: (tweet: Tweet, totalCount: number) => void
): Promise<Tweet[]> {
  const injected = await ensureNetworkCollectorInjected();
  if (!injected) {
    console.warn('Bookmark-X: Network collector injection failed; falling back to DOM collector.');
    return [];
  }

  // Session-scoped collection
  const sessionId =
    (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const tweetMap = new Map<string, Tweet>();
  let lastNewAt = Date.now();

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as InjectStatusMessage | any;
    if (!data || data.source !== 'bookmark-x') return;
    if (data.sessionId !== sessionId) return;

    if (data.type === 'BX_TWEETS' && Array.isArray(data.tweets)) {
      for (const t of data.tweets) {
        if (!t?.tweetId) continue;
        if (tweetMap.has(t.tweetId)) continue;
        tweetMap.set(t.tweetId, t);
        lastNewAt = Date.now();
        onTweetCollected?.(t, tweetMap.size);
      }
    }
  };

  window.addEventListener('message', onMessage);

  // Start capture
  window.postMessage({ source: 'bookmark-x', type: 'BX_COLLECTOR_START', sessionId }, '*');

  // Speed-first stopping conditions:
  // - stop after TIME_BUDGET_MS
  // - or once we have enough to make dashboard useful (TARGET_COUNT)
  // - or if network goes quiet for QUIET_MS after we’ve collected some minimum
  const TIME_BUDGET_MS = 25_000;
  const TARGET_COUNT = 600;
  const QUIET_MS = 2_000;
  const MIN_BEFORE_QUIET_STOP = 80;

  const start = Date.now();
  const scroller = getScrollContainer();

  while (Date.now() - start < TIME_BUDGET_MS && tweetMap.size < TARGET_COUNT) {
    // If we’ve collected a reasonable amount and network is quiet, stop quickly.
    if (tweetMap.size >= MIN_BEFORE_QUIET_STOP && Date.now() - lastNewAt > QUIET_MS) break;

    // Aggressive scroll to trigger more network pages.
    try {
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    } catch {
      window.scrollTo(0, document.body.scrollHeight);
    }

    // Small pause; network capture will stream results asynchronously.
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  window.postMessage({ source: 'bookmark-x', type: 'BX_COLLECTOR_STOP', sessionId }, '*');
  window.removeEventListener('message', onMessage);

  return Array.from(tweetMap.values());
}

// Collect tweets with progress callback
async function collectWithNewTurboMethod(
  timingMilestone: number, 
  startTime: number,
  onTweetCollected?: (tweet: Tweet, totalCount: number) => void
): Promise<Tweet[]> {
  const tweetMap = new Map<string, Tweet>();
  let consecutiveNoNewTweets = 0;
  let scrollAttempts = 0;
  let reachedMilestone = false;

  // Safety bounds (avoid infinite loops if X stops loading)
  const MAX_BOOKMARKS = 5000; // remove the old hard cap of 100; keep a high safety cap
  const MAX_SCROLL_ATTEMPTS = 300;
  const NO_NEW_TWEETS_LIMIT = 15; // was 8; X often needs more time to load the next batch
  const POST_SCROLL_WAIT_MS = 175; // was 175; too short for X network/virtualization
  const SETTLE_POLL_MS = 150;
  const SETTLE_MAX_MS = 2500;
  
  // Wait for initial tweets to load (up to 10 seconds)
  const startWaitTime = Date.now();
  while (Date.now() - startWaitTime < 10000) {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    if (tweets.length > 0) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Exit if no tweets found after waiting
  if (document.querySelectorAll('[data-testid="tweet"]').length === 0) {
    return [];
  }
  
  console.log('Bookmark-X: Starting tweet collection...');

  function getScrollContainer(): HTMLElement {
    // Prefer a real scroll container near the tweet list (X sometimes uses nested scrollers)
    const firstTweet = document.querySelector('[data-testid="tweet"]') as HTMLElement | null;
    if (firstTweet) {
      let el: HTMLElement | null = firstTweet.parentElement;
      while (el) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const scrollable =
          (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
          el.scrollHeight > el.clientHeight + 100;
        if (scrollable) return el;
        el = el.parentElement;
      }
    }

    // Fallback to the document scroller
    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }

  async function waitForSettle(previousTweetCount: number, previousScrollHeight: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < SETTLE_MAX_MS) {
      const currentTweetCount = document.querySelectorAll('[data-testid="tweet"]').length;
      const scroller = getScrollContainer();
      const scrollHeight = scroller.scrollHeight;

      // Heuristic: if either tweets in DOM increased or scrollHeight changed, content likely loaded
      if (currentTweetCount > previousTweetCount || scrollHeight !== previousScrollHeight) {
        return;
      }

      // If a progress indicator exists, give it time to finish
      const hasSpinner = document.querySelector('[role="progressbar"], [data-testid="app-bar-loading"], [aria-label="Loading"]');
      await new Promise(resolve => setTimeout(resolve, hasSpinner ? SETTLE_POLL_MS : SETTLE_POLL_MS));
    }
  }

  async function simulateVirtualScroll() {
    const scrollableParent = getScrollContainer();
    
    const tweets = scrollableParent.querySelectorAll('[data-testid="tweet"]');
    if (tweets.length === 0) return false;

    const lastTweet = tweets[tweets.length - 1] as HTMLElement;
    
    // console.log('Bookmark-X: Scroll attempt:', {
    //   currentScroll: scrollableParent.scrollTop,
    //   scrollHeight: scrollableParent.scrollHeight,
    //   lastTweetOffset: lastTweet.offsetTop,
    //   visibleTweets: tweets.length
    // });

    // Calculate scroll step (about 2-3 screens worth of content)
    const viewportHeight = window.innerHeight;
    const scrollStep = Math.min(viewportHeight * 3, 3000);
    const currentScroll = scrollableParent.scrollTop;
    const targetScroll = currentScroll + scrollStep;

    // Try multiple scroll methods
    try {
      const prevTweetCount = document.querySelectorAll('[data-testid="tweet"]').length;
      const prevScrollHeight = scrollableParent.scrollHeight;

      // Method 1: Direct scroll
      scrollableParent.scrollTop = targetScroll;
      
      // Method 2: Smooth scroll
      scrollableParent.scroll({
        top: targetScroll,
        behavior: 'smooth'
      });
    //   console.log('Bookmark-X: Smooth scroll result:', {
    //     beforeScroll: scrollableParent.scrollTop,
    //     targetScroll,
    //     afterScroll: scrollableParent.scrollTop,
    //     scrollChange: scrollableParent.scrollTop - targetScroll
    //   });

      // Method 3: Element scroll into view
      lastTweet.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Dispatch scroll event after physical scroll
      const scrollEvent = new Event('scroll', { bubbles: true });
      scrollableParent.dispatchEvent(scrollEvent);

      // Log scroll result
      // console.log('Bookmark-X: Scroll attempt result:', {
      //   beforeScroll: currentScroll,
      //   targetScroll,
      //   afterScroll: scrollableParent.scrollTop,
      //   scrollChange: scrollableParent.scrollTop - currentScroll
      // });

    } catch (error) {
      console.error('Bookmark-X: Error during scroll:', error);
    }

    // Wait for potential content load (X can be slow)
    const prevTweetCount = document.querySelectorAll('[data-testid="tweet"]').length;
    const prevScrollHeight = scrollableParent.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, POST_SCROLL_WAIT_MS));
    await waitForSettle(prevTweetCount, prevScrollHeight);

    return true;
  }
  
  while (consecutiveNoNewTweets < NO_NEW_TWEETS_LIMIT && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    const currentTweetElements = document.querySelectorAll('[data-testid="tweet"]');
    const previousCount = tweetMap.size;
    
    for (const tweetElement of Array.from(currentTweetElements)) {
      try {
        const statusLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
        if (!statusLink?.href) continue;
        
        const tweetUrl = statusLink.href;
        const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0];
        
        // Skip duplicate tweets
        if (!tweetId || tweetMap.has(tweetId)) continue;
        
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        const rawTweetText = (textElement?.textContent || '').trim();

        const hasMedia = tweetElement.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]') !== null;
        const media = hasMedia ? 'has_media' as const : null;

        // Include media-only bookmarks too (X often has bookmarks with no text)
        const tweetText = rawTweetText || (hasMedia ? '[Media-only bookmark]' : '');
        if (!tweetText) continue;

        const authorNameElement = tweetElement.querySelector('[data-testid="User-Name"] [dir="ltr"] span:first-child, [data-testid="User-Name"] span[dir="ltr"]:first-child, [data-testid="User-Name"] > div > div:first-child span');
        const authorName = authorNameElement?.innerHTML.trim() || '';

        // More reliable: username is the first path segment of /{username}/status/{id}
        let handle = '';
        try {
          const url = new URL(tweetUrl);
          handle = url.pathname.split('/')[1] || '';
        } catch {
          // Fallback
          const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
          handle = linkElement?.href?.split('/').pop() || '';
        }

        const timeElement = tweetElement.querySelector('time');
        const time = timeElement?.getAttribute('datetime') || '';

        const profilePicture = extractProfilePicture(tweetElement);

        const tweet: Tweet = {
          tweetId,
          tweetUrl,
          authorName,
          handle,
          tweetText,
          time,
          profilePicture,
          media
        };

        tweetMap.set(tweetId, tweet);

        if (onTweetCollected) {
          onTweetCollected(tweet, tweetMap.size);
        }

        if (tweetMap.size >= MAX_BOOKMARKS) {
          console.warn(`Bookmark-X: Reached safety cap of ${MAX_BOOKMARKS} bookmarks; stopping collection to avoid infinite loop.`);
          return Array.from(tweetMap.values());
        }

        if (!reachedMilestone && tweetMap.size >= timingMilestone) {
          const timeToMilestone = Date.now() - startTime;
          // console.log(`Bookmark-X: Reached ${timingMilestone} tweets in ${timeToMilestone/1000} seconds`);
          reachedMilestone = true;
        }
      } catch (error) {
        console.error('Bookmark-X: Error processing tweet:', error);
      }
    }
    
    const newTweetsFound = tweetMap.size - previousCount;
    if (newTweetsFound > 0) {
      consecutiveNoNewTweets = 0;
      console.log(`Bookmark-X: Found ${newTweetsFound} new tweets (total: ${tweetMap.size})`);
    } else {
      consecutiveNoNewTweets++;
      console.log(`Bookmark-X: No new tweets found. Consecutive count: ${consecutiveNoNewTweets}/${NO_NEW_TWEETS_LIMIT}`);
    }

    // Try to trigger virtual scroll
    const scrolled = await simulateVirtualScroll();
    if (!scrolled) {
      console.log('Bookmark-X: Could not trigger virtual scroll');
      break;
    }

    scrollAttempts++;
  }
  
  console.log(`Bookmark-X: Tweet collection completed. Total collected: ${tweetMap.size}. Scroll attempts: ${scrollAttempts}.`);
  return Array.from(tweetMap.values());
}

// Handle bulk bookmark operation - works for both fresh installs and manual sync
export async function handleBulkBookmark() {
  try {
    // Check if user is logged in first
    const userInfo = await getTwitterUserInfo();
    if (!userInfo) {
      return;
    }

    // Create and add the loading modal
    const { modal, carouselContainer, progressText } = createLoadingModal();
    document.body.appendChild(modal);
    
    const carousel = new TweetCarousel(carouselContainer);

    // Send user info to background script for server processing
    await chrome.runtime.sendMessage({
      type: 'SET_TWITTER_USER',
      data: userInfo
    });
    
    console.log('Bookmark-X: Starting tweet collection...');
    
    // Collect tweets with progress updates
    const startTime = Date.now();
    let allTweetData = await collectWithNetworkCapture((tweet, count) => {
      carousel.addTweet(tweet);
      if (count % 10 === 0 || count === 1) {
        progressText.textContent = `Collecting... ${count} bookmarks from network capture`;
      }
    });

    // Fallback to DOM collector if network capture got nothing
    if (allTweetData.length === 0) {
      allTweetData = await collectWithNewTurboMethod(1500, startTime, (tweet, count) => {
        carousel.addTweet(tweet);
        if (count % 3 === 0 || count === 1) {
          progressText.textContent = `Collecting... ${count} bookmarks from DOM collector`;
        }
      });
    }
    
    if (allTweetData.length === 0) {
      showNotification('No tweets found to bookmark', 'error');
      modal.remove();
      return;
    }
    
    // Send raw JSON to background script for processing
    progressText.textContent = '✨ Working our magic to sort your tweets...';
    
    const response = await chrome.runtime.sendMessage({
      type: 'PROCESS_TWEET_JSON_BULK',
      data: allTweetData
    });
    
    // Show final status for 2 seconds before removing modal
    const collectedCount = allTweetData.length;
    const processedCount = response.processedCount ?? 0;
    const skippedCount = Math.max(0, collectedCount - processedCount);

    progressText.textContent = response.success
      ? `Collected ${collectedCount}. Saved ${processedCount}${skippedCount ? ` (skipped ${skippedCount} duplicates)` : ''}.`
      : `Oops! ${response.error}`;
    
    setTimeout(() => {
      carousel.stop();
      modal.remove();
      
      if (response.success) {
        showNotification(`Successfully processed ${response.processedCount} tweets!`, 'success');
      } else {
        showNotification(`Failed to process tweets: ${response.error}`, 'error');
      }
    }, 2000);
    
  } catch (error) {
    console.error('Error during bulk bookmark:', error);
    showNotification('Failed to collect tweets', 'error');
    document.querySelector('.bookmarkbuddy-modal')?.remove();
  }
} 