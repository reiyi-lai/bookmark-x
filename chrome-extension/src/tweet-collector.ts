import { CollectedTweet as Tweet } from '../../shared/schema';
import { TweetCarousel, createLoadingModal } from './components/modal';
import { showButtonLoading, showButtonSuccess, showButtonError, showNotification } from './components/button-states';

// Get Twitter user info
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
        
        // Store in chrome.storage.local
        await chrome.storage.local.set({
          twitter_user_id: userInfo.id,
          twitter_username: userInfo.username
        });
        
        return userInfo;
      }
    }

    console.warn('BookmarkBuddy: Could not find Twitter user info in initial state');
    return null;

  } catch (error) {
    console.error('BookmarkBuddy: Error getting Twitter user info:', error);
    return null;
  }
}

// Extract profile picture URL from twitter handle for speed
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

// Collect tweets with progress callback
async function collectWithNewTurboMethod(
  timingMilestone: number, 
  startTime: number,
  onTweetCollected?: (tweet: Tweet, totalCount: number) => void
): Promise<Tweet[]> {
  const tweetMap = new Map<string, Tweet>();
  let consecutiveNoNewTweets = 0;
  let scrollAttempts = 0;
  let lastScrollHeight = 0;
  let reachedMilestone = false;
  
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
          const media = hasMedia ? 'has_media' as const : null;
          
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
      consecutiveNoNewTweets = 0;
    } else {
      consecutiveNoNewTweets++;
    }
    
    // Check if we reached the bottom
    const currentScrollHeight = document.body.scrollHeight;
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const isAtBottom = (currentScrollTop + windowHeight) >= (currentScrollHeight - 100);
    
    if (currentScrollHeight === lastScrollHeight && isAtBottom && scrollAttempts > 6) {
      consecutiveNoNewTweets++;
    }
    lastScrollHeight = currentScrollHeight;
    
    // Scroll to bottom of page
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for new content
    await new Promise(resolve => setTimeout(resolve, waitTime));
    scrollAttempts++;
  }
  
  return Array.from(tweetMap.values());
}

// Handle bulk bookmark operation
export async function handleBulkBookmark() {
  try {
    // Create and add the loading modal
    const { modal, carouselContainer, progressText } = createLoadingModal();
    document.body.appendChild(modal);
    
    const carousel = new TweetCarousel(carouselContainer);

    // Get Twitter user info first
    const twitterUser = await getTwitterUserInfo();
    if (!twitterUser) {
      showNotification('Please make sure you are logged into Twitter/X', 'error');
      modal.remove();
      return;
    }

    // Send Twitter user info to background script
    await chrome.runtime.sendMessage({
      type: 'SET_TWITTER_USER',
      data: twitterUser
    });
    
    console.log('BookmarkBuddy: Starting tweet collection...');
    // progressText.textContent = 'Finding your bookmarks...';
    
    // Collect tweets with progress updates
    const startTime = Date.now();
    const allTweetData = await collectWithNewTurboMethod(1500, startTime, (tweet, count) => {
      carousel.addTweet(tweet);
      progressText.textContent = `Collecting... ${count} bookmarks`;
    });
    
    console.log(`BookmarkBuddy: Collected ${allTweetData.length} tweets as raw JSON`);
    
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
    progressText.textContent = response.success 
      ? `Successfully organized ${response.processedCount} tweets!`
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