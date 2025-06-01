if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBookmarkBuddy);
} else {
  initializeBookmarkBuddy();
}

function initializeBookmarkBuddy() {
  addBookmarkButtonToHeader();
}

// Add bookmark button next to the page title
function addBookmarkButtonToHeader() {
  // Find page title "Bookmarks"
  const pageTitle = findPageTitle();
  
  if (!pageTitle) {
    setTimeout(addBookmarkButtonToHeader, 1000);
    return;
  }
  
  if (document.querySelector('.bookmarkbuddy-header-btn')) {
    return;
  }
  
  const button = createHeaderButton();
  insertButtonNearTitle(pageTitle, button);
}

// Find page title "Bookmarks"
function findPageTitle(): Element | null {
  console.log('BookmarkBuddy: Searching for page title...');
  
  // Try multiple selectors to find the Bookmarks heading
  const selectors = [
    'h2[role="heading"][aria-level="2"]'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`BookmarkBuddy: Trying selector "${selector}", found ${elements.length} elements`);
    
    for (const element of elements) {
      console.log(`BookmarkBuddy: Checking element:`, element.textContent, element);
      if (element.textContent?.includes('Bookmarks')) {
        console.log('BookmarkBuddy: Found Bookmarks title with selector:', selector);
        return element;
      }
    }
  }
  
  console.log('BookmarkBuddy: No Bookmarks title found');
  console.log('BookmarkBuddy: Current URL:', window.location.href);
  console.log('BookmarkBuddy: Page title:', document.title);
  
  return null;
}

// Create the header bookmark button
function createHeaderButton(): HTMLElement {
  const button = document.createElement('button');
  button.className = 'bookmarkbuddy-header-btn';
  button.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgb(29, 155, 240);
      color: white;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-left: 16px;
    "
    onmouseover="this.style.backgroundColor='rgb(26, 140, 216)'"
    onmouseout="this.style.backgroundColor='rgb(29, 155, 240)'"
    title="Save all bookmarks to BookmarkBuddy">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21V5C19 3.9 18.1 3 17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21Z" 
              stroke="currentColor" stroke-width="2" fill="currentColor"/>
      </svg>
      <span>Sync to Bookmark-X</span>
    </div>
  `;
  
  // Add click handler
  button.addEventListener('click', handleBulkBookmark);
  
  return button;
}

// Insert button near the page title
function insertButtonNearTitle(titleElement: Element, button: HTMLElement) {
  // Try to find a good parent container
  const titleParent = titleElement.parentElement;
  
  if (titleParent) {
    // If parent has flex display, add button as sibling
    const titleParentStyle = window.getComputedStyle(titleParent);
    if (titleParentStyle.display === 'flex') {
      titleParent.appendChild(button);
    } else {
      // Create a wrapper to put title and button side by side
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%;';
      
      titleParent.insertBefore(wrapper, titleElement);
      wrapper.appendChild(titleElement);
      wrapper.appendChild(button);
    }
  } else {
    // Fallback: insert after title element
    titleElement.insertAdjacentElement('afterend', button);
  }
}

// Handle bulk bookmark operation - collect raw JSON first, process in background
async function handleBulkBookmark() {
  try {
    const button = document.querySelector('.bookmarkbuddy-header-btn') as HTMLElement;
    if (!button) return;
    
    // Show loading state
    showButtonLoading(button, true);
    
    console.log('BookmarkBuddy: Starting intelligent tweet collection...');
    
    // Collect all tweets as raw JSON data
    const allTweetData = await collectAllTweetsAsJSON();
    
    console.log(`BookmarkBuddy: Collected ${allTweetData.length} tweets as raw JSON`);
    
    if (allTweetData.length === 0) {
      showNotification('No tweets found to bookmark', 'error');
      showButtonLoading(button, false);
      return;
    }
    
    // Send raw JSON to background script for processing
    updateCollectionProgress('Processing...');
    
    const response = await chrome.runtime.sendMessage({
      type: 'PROCESS_TWEET_JSON_BULK',
      data: allTweetData
    });
    
    if (response.success) {
      showButtonSuccess(button);
      showNotification(`Successfully processed ${response.processedCount} tweets!`, 'success');
    } else {
      showButtonError(button);
      showNotification(`Failed to process tweets: ${response.error}`, 'error');
    }
    
  } catch (error) {
    console.error('Error during bulk bookmark:', error);
    showNotification('Failed to collect tweets', 'error');
    const button = document.querySelector('.bookmarkbuddy-header-btn') as HTMLElement;
    if (button) showButtonError(button);
  }
}

// Collect tweets with configurable modes - easy to test different approaches
async function collectAllTweetsAsJSON(): Promise<any[]> {
  const tweets: any[] = [];
  const TIMING_MILESTONE = 1500; // Track time to reach this many tweets
  const TEMP_TEST_LIMIT = 1000; // TEMPORARY: Testing limit
  let reachedMilestone = false;
  const startTime = Date.now();
  
  // MODE SELECTION - Change this to test different approaches
  let MODE: 'CONSERVATIVE' | 'TURBO_FAST' | 'TURBO_ULTRA' = 'TURBO_FAST';
  
  let scrollInterval: number;
  let scrollStep: number;
  let patienceLevel: number;
  let useNewTurboMethod = false;
  
  // @ts-ignore - MODE can be changed for testing different modes
  if (MODE === 'CONSERVATIVE') {
    scrollInterval = 700;
    scrollStep = 5500;
    patienceLevel = 5;
    useNewTurboMethod = false;
    console.log('BookmarkBuddy: Starting CONSERVATIVE collection (most reliable)...');
  // @ts-ignore - MODE can be changed for testing different modes  
  } else if (MODE === 'TURBO_FAST') {
    useNewTurboMethod = true;
    console.log('BookmarkBuddy: Starting TURBO_FAST collection (150ms delays)...');
  } else {
    // TURBO_ULTRA
    useNewTurboMethod = true;
    console.log('BookmarkBuddy: Starting TURBO_ULTRA collection (100ms delays)...');
  }
  
  // Use the new turbo method for TURBO modes
  if (useNewTurboMethod) {
    const collectedTweets = await collectWithNewTurboMethod(MODE, TIMING_MILESTONE, startTime);
    // TEMPORARY: Limit tweets for testing
    // if (collectedTweets.length > TEMP_TEST_LIMIT) {
    //   console.log(`BookmarkBuddy: Limiting to ${TEMP_TEST_LIMIT} tweets for testing`);
    //   return collectedTweets.slice(0, TEMP_TEST_LIMIT);
    // }
    return collectedTweets;
  }
  
  // Original conservative method for CONSERVATIVE mode
  let previousTweetCount = 0;
  let unchangedCount = 0;
  let turboScrollCount = 0;
  let lastContentLoadTime = Date.now();
  
  return new Promise((resolve) => {
    function updateTweets() {
      const currentTweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      let newTweetsCount = 0;
      
      currentTweetElements.forEach(tweetElement => {
        try {
          const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
          const tweetText = textElement?.textContent || '';
          
          const isTweetNew = tweetText && !tweets.some(tweet => tweet.tweetText === tweetText);
          
          if (isTweetNew) {
            const authorNameElement = tweetElement.querySelector('[data-testid="User-Name"] [dir="ltr"] span:first-child, [data-testid="User-Name"] span[dir="ltr"]:first-child, [data-testid="User-Name"] > div > div:first-child span');
            const authorName = authorNameElement?.textContent?.split(/[@·]/)[0].trim();
            
            const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
            const handle = linkElement?.href?.split('/').pop() || '';
            
            const timeElement = tweetElement.querySelector('time');
            const time = timeElement?.getAttribute('datetime') || '';
            
            const statusLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
            const tweetUrl = statusLink?.href || '';
            const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0] || '';
            
            const hasMedia = tweetElement.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]') !== null;
            const media = hasMedia ? 'has_media' : null;
            
            // Enhanced profile picture extraction with multiple fallbacks
            const profilePicture = extractProfilePicture(tweetElement);
            
            tweets.push({
              tweetId,
              tweetUrl,
              authorName,
              handle,
              tweetText,
              time,
              profilePicture,
              media
            });
            
            newTweetsCount++;

            if (!reachedMilestone && tweets.length >= TIMING_MILESTONE) {
              const timeToMilestone = Date.now() - startTime;
              console.log(`BookmarkBuddy: Reached ${TIMING_MILESTONE} tweets in ${timeToMilestone/1000} seconds (${MODE} mode)`);
              reachedMilestone = true;
            }

            // TEMPORARY: Stop at 1000 tweets for testing
            if (tweets.length >= 1000) {
              const totalTime = (Date.now() - startTime) / 1000;
              console.log(`BookmarkBuddy: Reached temporary 1000 tweet test limit in ${totalTime} seconds`);
              return tweets;
            }
          }
        } catch (error) {
          // Silent error handling for speed
        }
      });
      
      if (newTweetsCount > 0) {
        lastContentLoadTime = Date.now();
      }
      
      if (newTweetsCount > 0 && tweets.length % 50 === 0) {
        console.log(`BookmarkBuddy: ${tweets.length} tweets collected (${MODE}) - ${newTweetsCount} new`);
      }
    }
    
    updateTweets();
    
    const observer = new MutationObserver(() => {
      updateTweets();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    const scrollIntervalID = setInterval(() => {
      window.scrollBy(0, scrollStep);
      updateCollectionProgress(`${tweets.length} (${MODE})`);
      turboScrollCount++;
      
      const currentTweetCount = tweets.length;
      if (currentTweetCount === previousTweetCount) {
        unchangedCount++;
        
        if (unchangedCount >= patienceLevel) {
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`BookmarkBuddy: ${MODE} collection complete - reached end of bookmarks!`);
          console.log(`BookmarkBuddy: Collected ${tweets.length} tweets in ${totalTime} seconds (${MODE} mode)`);
          clearInterval(scrollIntervalID);
          observer.disconnect();
          resolve(tweets);
        }
      } else {
        unchangedCount = 0;
      }
      previousTweetCount = currentTweetCount;
    }, scrollInterval);
  });
}

// New turbo collection method based on user's optimized approach
async function collectWithNewTurboMethod(mode: string, timingMilestone: number, startTime: number): Promise<any[]> {
  const allTweetElements = new Set<Element>();
  const tweets: any[] = [];
  let consecutiveNoNewTweets = 0;
  let scrollAttempts = 0;
  let lastScrollHeight = 0;
  let reachedMilestone = false;
  
  // Different delays for different turbo modes
  const waitTime = mode === 'TURBO_ULTRA' ? 100 : 300; // 100ms for ultra, 300ms for fast
  
  console.log(`BookmarkBuddy: Starting fast tweet collection with optimized infinite scroll (${waitTime}ms delays)...`);
  
  // Continue until we truly reach the end (no arbitrary scroll limit)
  while (consecutiveNoNewTweets < 8) {
    const currentTweetElements = document.querySelectorAll('[data-testid="tweet"]');
    const previousCount = allTweetElements.size;
    
    // Add new tweet elements to our collection
    currentTweetElements.forEach(tweet => allTweetElements.add(tweet));
    
    const newTweetsFound = allTweetElements.size - previousCount;
    console.log(`BookmarkBuddy: +${newTweetsFound} tweets (total: ${allTweetElements.size})`);
    
    if (newTweetsFound === 0) {
      consecutiveNoNewTweets++;
    //   console.log(`BookmarkBuddy: No new tweets found (${consecutiveNoNewTweets}/8 attempts)`);
    } else {
      consecutiveNoNewTweets = 0;
      
      // Extract data from new tweets only
      const newTweetArray = Array.from(allTweetElements).slice(tweets.length);
      for (const tweetElement of newTweetArray) {
        try {
          const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
          const tweetText = textElement?.textContent || '';
          
          if (tweetText) {
            const authorNameElement = tweetElement.querySelector('[data-testid="User-Name"] [dir="ltr"] span:first-child, [data-testid="User-Name"] span[dir="ltr"]:first-child, [data-testid="User-Name"] > div > div:first-child span');
            const authorName = authorNameElement?.textContent?.split(/[@·]/)[0].trim();
            
            const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
            const handle = linkElement?.href?.split('/').pop() || '';
            
            const timeElement = tweetElement.querySelector('time');
            const time = timeElement?.getAttribute('datetime') || '';
            
            const statusLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
            const tweetUrl = statusLink?.href || '';
            const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0] || '';
            
            const hasMedia = tweetElement.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]') !== null;
            const media = hasMedia ? 'has_media' : null;
            
            // Enhanced profile picture extraction with multiple fallbacks
            const profilePicture = extractProfilePicture(tweetElement);
            
            tweets.push({
              tweetId,
              tweetUrl,
              authorName,
              handle,
              tweetText,
              time,
              profilePicture,
              media
            });

            // TEMPORARY: Stop at 1000 tweets for testing
            if (tweets.length >= 500) {
              const totalTime = (Date.now() - startTime) / 1000;
              console.log(`BookmarkBuddy: Reached temporary 500 tweet test limit in ${totalTime} seconds`);
              return tweets;
            }

            if (!reachedMilestone && tweets.length >= timingMilestone) {
              const timeToMilestone = Date.now() - startTime;
              console.log(`BookmarkBuddy: Reached ${timingMilestone} tweets in ${timeToMilestone/1000} seconds (${mode} mode)`);
              reachedMilestone = true;
            }
          }
        } catch (error) {
          // Silent error handling
        }
      }
    }
    
    // Check if we've reached the bottom by comparing scroll heights
    const currentScrollHeight = document.body.scrollHeight;
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    
    // More robust bottom detection
    const isAtBottom = (currentScrollTop + windowHeight) >= (currentScrollHeight - 100); // 100px tolerance
    
    if (currentScrollHeight === lastScrollHeight && isAtBottom && scrollAttempts > 5) {
    //   consecutiveNoNewTweets++;
      console.log(`BookmarkBuddy: Reached bottom - incrementing no-new count to ${consecutiveNoNewTweets}`);
    }
    lastScrollHeight = currentScrollHeight;
    
    // Scroll to the very bottom of the page (not just a fixed amount)
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for new content - optimized for speed
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    scrollAttempts++;
    
    // Update progress every 5 scrolls
    if (scrollAttempts % 5 === 0) {
      updateCollectionProgress(`${tweets.length} (${mode})`);
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`BookmarkBuddy: Stopped due to reaching end of bookmarks after ${consecutiveNoNewTweets} consecutive attempts with no new content`);
  console.log(`BookmarkBuddy: Total scroll attempts: ${scrollAttempts}`);
  console.log(`BookmarkBuddy: ${mode} collection complete!`);
  console.log(`BookmarkBuddy: Collected ${tweets.length} tweets in ${totalTime} seconds (${mode} mode)`);
  return tweets;
}

// Update collection progress in button
function updateCollectionProgress(progress: number | string): void {
  const button = document.querySelector('.bookmarkbuddy-header-btn') as HTMLElement;
  if (button) {
    const buttonContent = button.querySelector('div');
    if (buttonContent) {
      buttonContent.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
          <path d="M12 2C6.5 2 2 6.5 2 12" stroke="currentColor" stroke-width="2" fill="none">
            <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="0.8s" repeatCount="indefinite"/>
          </path>
        </svg>
        <span>Collecting... ${progress}</span>
      `;
    }
  }
}

// UI Helper functions for the header button
function showButtonLoading(buttonElement: HTMLElement, loading: boolean) {
  const buttonContent = buttonElement.querySelector('div');
  if (!buttonContent) return;
  
  if (loading) {
    buttonContent.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
        <path d="M12 2C6.5 2 2 6.5 2 12" stroke="currentColor" stroke-width="2" fill="none">
          <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      </svg>
      <span>Saving...</span>
    `;
  }
}

function showButtonSuccess(buttonElement: HTMLElement) {
  const buttonContent = buttonElement.querySelector('div');
  if (!buttonContent) return;
  
  buttonContent.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
    <span>Saved!</span>
  `;
  
  // Reset after 3 seconds
  setTimeout(() => {
    buttonContent.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21V5C19 3.9 18.1 3 17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21Z" 
              stroke="currentColor" stroke-width="2" fill="currentColor"/>
      </svg>
      <span>Sync to Bookmark-X</span>
    `;
  }, 3000);
}

function showButtonError(buttonElement: HTMLElement) {
  const buttonContent = buttonElement.querySelector('div');
  if (!buttonContent) return;
  
  buttonContent.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
    </svg>
    <span>Failed</span>
  `;
  
  // Reset after 3 seconds
  setTimeout(() => {
    buttonContent.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21V5C19 3.9 18.1 3 17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21Z" 
              stroke="currentColor" stroke-width="2" fill="currentColor"/>
      </svg>
      <span>Sync to Bookmark-X</span>
    `;
  }, 3000);
}

function showNotification(message: string, type: 'success' | 'error') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 300px;
    transition: opacity 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Enhanced profile picture extraction with fallback to constructed URLs
function extractProfilePicture(tweetElement: Element): string {
  // Try the 2 working selectors first
  const workingSelectors = [
    '[data-testid="Tweet-User-Avatar"] img',    // Primary selector
    '[role="link"] img[alt]'                    // Alternative selector
  ];
  
  for (const selector of workingSelectors) {
    try {
      const imgElement = tweetElement.querySelector(selector) as HTMLImageElement;
      if (imgElement?.src && imgElement.src.startsWith('http')) {
        const src = imgElement.src;
        if (src.includes('profile_images') || src.includes('pbs.twimg.com')) {
          return src;
        }
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  // Fallback: Extract handle and construct profile picture URL
  try {
    const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
    if (linkElement?.href) {
      const handle = linkElement.href.split('/').pop();
      if (handle && handle !== 'photo' && handle !== 'status') {
        // Construct the profile picture URL using Twitter's API pattern
        // This will redirect to the actual profile picture
        const fallbackUrl = `https://unavatar.io/twitter/${handle}`;
        return fallbackUrl;
      }
    }
  } catch (error) {
    // Silent fallback
  }
  
  return '';
} 