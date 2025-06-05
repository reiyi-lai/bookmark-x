if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBookmarkBuddy);
} else {
  initializeBookmarkBuddy();
}

function initializeBookmarkBuddy() {
  addSyncButton();
  
  // Watch for URL changes
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(addSyncButton, 500); // Let page content load
    }
  });
}

// Add sync button to the bookmarks page header
function addSyncButton() {
  // Don't add if button already exists
  if (document.querySelector('.bookmarkbuddy-header-btn')) {
    return;
  }

  // Find the "Bookmarks" title element
  const titleElement = findPageTitle();
  if (!titleElement) {
    setTimeout(addSyncButton, 1000); // Retry if title not found
    return;
  }

  // Create and insert the button
  const button = createHeaderButton();
  const titleParent = titleElement.parentElement;
  
  if (titleParent) {
    // Create a flex container for title and button
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    // Replace title with container and add both elements
    titleParent.insertBefore(container, titleElement);
    container.appendChild(titleElement);
    container.appendChild(button);
  } else {
    // Fallback: insert after title
    titleElement.insertAdjacentElement('afterend', button);
  }
}

// Find page title "Bookmarks"
function findPageTitle(): Element | null {
  console.log('BookmarkBuddy: Searching for page title...');
  
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
  button.style.cssText = `
    display: inline-flex;
    margin-left: 16px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  `;
  
  button.innerHTML = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      background: rgb(14 165 233);
      color: white;
      border: none;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      cursor: pointer;
      transition: background-color 0.2s;
      line-height: 1.2;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21V5C19 3.9 18.1 3 17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21Z" 
              stroke="currentColor" stroke-width="2" fill="currentColor"/>
      </svg>
      <span>Sync to Bookmark-X</span>
    </div>
  `;
  
  // Add hover effect to the inner div
  const buttonContent = button.querySelector('div');
  if (buttonContent) {
    buttonContent.addEventListener('mouseover', () => {
      (buttonContent as HTMLElement).style.backgroundColor = 'rgb(2 132 199)';
    });
    
    buttonContent.addEventListener('mouseout', () => {
      (buttonContent as HTMLElement).style.backgroundColor = 'rgb(14 165 233)';
    });
  }
  
  // Add click handler
  button.addEventListener('click', handleBulkBookmark);
  
  return button;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TWITTER_AUTH') {
    getTwitterUserInfo().then(userInfo => {
      sendResponse({ isAuthenticated: !!userInfo });
    });
    return true; // Keep channel open for async response
  }
});

// Add this function to get Twitter user info
async function getTwitterUserInfo(): Promise<{ id: string; username: string } | null> {
  try {
    // Look for initial state data in script tags
    const scripts = Array.from(document.getElementsByTagName('script'));
    const stateScript = scripts.find(s => s.textContent?.includes('"screen_name"'));
    
    if (stateScript?.textContent) {
      // Extract both username and ID using a single regex
      const match = stateScript.textContent.match(/"screen_name":"([^"]+)".+"id_str":"(\d+)"/);
      if (match) {
        return {
          username: match[1],
          id: match[2]
        };
      }
    }

    console.warn('BookmarkBuddy: Could not find Twitter user info in initial state');
    return null;

  } catch (error) {
    console.error('BookmarkBuddy: Error getting Twitter user info:', error);
    return null;
  }
}

// Handle bulk bookmark operation - collect raw JSON first, process in background
async function handleBulkBookmark() {
  try {
    const button = document.querySelector('.bookmarkbuddy-header-btn') as HTMLElement;
    if (!button) return;
    
    // Show loading state
    showButtonLoading(button, true);
    
    // Get Twitter user info first
    const twitterUser = await getTwitterUserInfo();
    if (!twitterUser) {
      showNotification('Please make sure you are logged into Twitter/X', 'error');
      showButtonLoading(button, false);
      return;
    }

    // Send Twitter user info to background script
    await chrome.runtime.sendMessage({
      type: 'SET_TWITTER_USER',
      data: twitterUser
    });
    
    console.log('BookmarkBuddy: Starting intelligent tweet collection...');
    
    // Collect tweets
    const startTime = Date.now();
    const allTweetData = await collectWithNewTurboMethod(1500, startTime);
    
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

interface Tweet {
  tweetId: string;
  tweetUrl: string;
  authorName: string;
  handle: string;
  tweetText: string;
  time: string;
  profilePicture: string;
  media: 'has_media' | null;
}

async function collectWithNewTurboMethod(timingMilestone: number, startTime: number): Promise<Tweet[]> {
  const tweetMap = new Map<string, Tweet>();
  let consecutiveNoNewTweets = 0;
  let scrollAttempts = 0;
  let lastScrollHeight = 0;
  let reachedMilestone = false;
  
  const waitTime = 175;
  console.log('BookmarkBuddy: Starting tweet collection...');
  
  while (consecutiveNoNewTweets < 8) {
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
        const tweetText = textElement?.textContent || '';
        
        if (tweetText) {
          const authorNameElement = tweetElement.querySelector('[data-testid="User-Name"] [dir="ltr"] span:first-child, [data-testid="User-Name"] span[dir="ltr"]:first-child, [data-testid="User-Name"] > div > div:first-child span');
          const authorName = authorNameElement?.innerHTML.trim() || '';
          
          const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
          const handle = linkElement?.href?.split('/').pop() || '';
          
          const timeElement = tweetElement.querySelector('time');
          const time = timeElement?.getAttribute('datetime') || '';
          
          const hasMedia = tweetElement.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]') !== null;
          const media = hasMedia ? 'has_media' : null;
          
          const profilePicture = extractProfilePicture(tweetElement);
          
          tweetMap.set(tweetId, {
            tweetId,
            tweetUrl,
            authorName,
            handle,
            tweetText,
            time,
            profilePicture,
            media
          });

          // TEMPORARY: Stop at 300 tweets for testing
          if (tweetMap.size >= 300) {
            const totalTime = (Date.now() - startTime) / 1000;
            console.log(`BookmarkBuddy: Reached temporary 300 tweet test limit in ${totalTime} seconds`);
            return Array.from(tweetMap.values());
          }

          if (!reachedMilestone && tweetMap.size >= timingMilestone) {
            const timeToMilestone = Date.now() - startTime;
            console.log(`BookmarkBuddy: Reached ${timingMilestone} tweets in ${timeToMilestone/1000} seconds`);
            reachedMilestone = true;
          }
        }
      } catch (error) {
        console.error('BookmarkBuddy: Error processing tweet:', error);
      }
    }
    
    const newTweetsFound = tweetMap.size - previousCount;
    if (newTweetsFound > 0) {
      console.log(`BookmarkBuddy: +${newTweetsFound} tweets (total: ${tweetMap.size})`);
      consecutiveNoNewTweets = 0;
      updateCollectionProgress(`${tweetMap.size}`);
    } else {
      consecutiveNoNewTweets++;
    }
    
    // Check if we reached the bottom
    const currentScrollHeight = document.body.scrollHeight;
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const isAtBottom = (currentScrollTop + windowHeight) >= (currentScrollHeight - 100);
    
    if (currentScrollHeight === lastScrollHeight && isAtBottom && scrollAttempts > 6) {
      console.log(`BookmarkBuddy: Reached bottom - incrementing no-new count to ${consecutiveNoNewTweets}`);
    }
    lastScrollHeight = currentScrollHeight;
    
    // Scroll to bottom of page
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for new content
    await new Promise(resolve => setTimeout(resolve, waitTime));
    scrollAttempts++;
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`BookmarkBuddy: Collection complete! ${tweetMap.size} tweets in ${totalTime} seconds`);
  
  return Array.from(tweetMap.values());
}

// Display collection progress via button
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

// Construct profile picture URL from twitter handle for speed
function extractProfilePicture(tweetElement: Element): string {
  try {
    const linkElement = tweetElement.querySelector('[role="link"]') as HTMLAnchorElement;
    if (linkElement?.href) {
      const handle = linkElement.href.split('/').pop();
      if (handle && handle !== 'photo' && handle !== 'status') {
        return `https://unavatar.io/twitter/${handle}`;
      }
    }
  } catch (error) {
    // Silent fallback
  }
  
  return '';
} 