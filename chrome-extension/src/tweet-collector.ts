import { CollectedTweet as Tweet } from '../../shared/schema';
import { TweetCarousel, createLoadingModal } from './components/modal';
import { showNotification } from './components/sync-button';

type InjectMessage =
  | { source: 'bookmark-x'; type: 'BX_TWEETS'; sessionId: string; tweets: Tweet[]; totalUnique: number; url: string }
  | { source: 'bookmark-x'; type: 'BX_PAGINATION_DONE'; sessionId: string; totalUnique: number };

let collectorInjected = false;

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
  // Try to find the actual scrollable ancestor near the timeline (X often uses nested scrollers).
  const firstTweet = document.querySelector('[data-testid="tweet"]') as HTMLElement | null;
  if (firstTweet) {
    let el: HTMLElement | null = firstTweet.parentElement;
    let depth = 0;
    while (el && depth < 20) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const scrollable =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        el.scrollHeight > el.clientHeight + 50;
      
      if (scrollable) return el;
      el = el.parentElement;
      depth++;
    }
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}


export async function ensureCollectorInjected(): Promise<boolean> {
  if (collectorInjected) return true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'INJECT_COLLECTOR_SCRIPT' });
    if (response.success) {
      collectorInjected = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}


async function collectWithNetworkCapture(
  onTweetCollected?: (tweet: Tweet, totalCount: number) => void,
): Promise<Tweet[]> {

  const injected = await ensureCollectorInjected();
  if (!injected) {
    console.log('Bookmark-X: Injection failed, falling back to DOM');
    return [];
  }

  const collected = new Map<string, Tweet>();
  const sessionId = `bx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<Tweet[]>((resolve) => {
    let done = false;
    let paginationDone = false;

    const cleanup = () => {
      done = true;
      window.removeEventListener('message', messageHandler);
      window.postMessage({ source: 'bookmark-x', type: 'BX_COLLECTOR_STOP', sessionId }, '*');
      resolve(Array.from(collected.values()));
    };

    const messageHandler = (event: MessageEvent) => {
      if (done) return;
      const data = event.data;
      if (!data || data.source !== 'bookmark-x') return;
      if (data.sessionId !== sessionId) return;

      if (data.type === 'BX_TWEETS') {
        const msg = data as InjectMessage & { type: 'BX_TWEETS' };
        for (const tweet of msg.tweets) {
          if (!collected.has(tweet.tweetId)) {
            collected.set(tweet.tweetId, tweet);
            onTweetCollected?.(tweet, collected.size);
          }
        }
      }

      if (data.type === 'BX_PAGINATION_DONE') {
        paginationDone = true;
      }
    };

    window.addEventListener('message', messageHandler);

    // Start the collector (flushes prebuffered responses)
    window.postMessage({ source: 'bookmark-x', type: 'BX_COLLECTOR_START', sessionId }, '*');

    const run = async () => {
      // Phase 1: One scroll to trigger the initial Bookmarks XHR
      await new Promise(r => setTimeout(r, 1000));
      const scroller = getScrollContainer();
      scroller.scrollTop += Math.min(window.innerHeight * 3, 3000);
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Wait for first batch to arrive (confirms the XHR hook works)
      const firstBatchStart = Date.now();
      while (Date.now() - firstBatchStart < 8000) {
        if (collected.size > 0) break;
        await new Promise(r => setTimeout(r, 100));
      }

      if (collected.size === 0) {
        if (!done) cleanup();
        return;
      }

      // Phase 2: Direct cursor pagination — no more scrolling needed
      window.postMessage({ source: 'bookmark-x', type: 'BX_COLLECTOR_FETCH_PAGES', sessionId }, '*');

      // Wait for pagination to complete
      const paginationStart = Date.now();
      const PAGINATION_TIMEOUT_MS = 120_000;
      let lastSize = collected.size;
      let staleSince = Date.now();

      while (!done && !paginationDone && Date.now() - paginationStart < PAGINATION_TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, 200));
        if (collected.size > lastSize) {
          lastSize = collected.size;
          staleSince = Date.now();
        }
        if (Date.now() - staleSince > 10_000) break;
      }

      if (!done) cleanup();
    };

    run();
  });
}

// Collect tweets with progress callback
async function collectWithNewTurboMethod(
  timingMilestone: number,
  onTweetCollected?: (tweet: Tweet, totalCount: number) => void
): Promise<Tweet[]> {
  const tweetMap = new Map<string, Tweet>();
  let consecutiveNoNewTweets = 0;
  let scrollAttempts = 0;
  let reachedMilestone = false;

  // Safety bounds (avoid infinite loops if X stops loading)
  const MAX_BOOKMARKS = 350;
  const MAX_SCROLL_ATTEMPTS = 300;
  const NO_NEW_TWEETS_LIMIT = 15; // was 8; X often needs more time to load the next batch
  const POST_SCROLL_WAIT_MS = 175; 
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

      const hasSpinner = document.querySelector('[role="progressbar"], [data-testid="app-bar-loading"], [aria-label="Loading"]');
      await new Promise(resolve => setTimeout(resolve, hasSpinner ? SETTLE_POLL_MS * 3 : SETTLE_POLL_MS));
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
    
    progressText.textContent = 'Collecting your bookmarks...';

    let allTweetData = await collectWithNetworkCapture((tweet, count) => {
      carousel.addTweet(tweet);
      if (count % 10 === 0 || count === 1) {
        progressText.textContent = `Collecting... ${count} bookmarks`;
      }
    });

    // Fallback to DOM scraping if network capture got nothing
    if (allTweetData.length === 0) {
      progressText.textContent = 'Collecting...';
      allTweetData = await collectWithNewTurboMethod(1500, (tweet, count) => {
        carousel.addTweet(tweet);
        if (count % 3 === 0 || count === 1) {
          progressText.textContent = `Collecting... ${count} bookmarks found`;
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
