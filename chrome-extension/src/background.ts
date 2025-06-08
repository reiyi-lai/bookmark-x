import type { ImportedBookmark } from '../../shared/schema';

console.log('Bookmark-X background script loaded');

const API_URL = 'https://bookmark-x-production.up.railway.app';
const FRONTEND_URL = 'https://bookmark-x.info';

// Twitter user info received from content script
let twitterUser: { id: string; username: string } | null = null;

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // console.log('Bookmark-X: Extension installed, opening bookmarks page...');
    
    await chrome.storage.local.set({ isNewInstall: true });
    
    await chrome.tabs.create({
      url: 'https://twitter.com/i/bookmarks'
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log('Bookmark-X: Received message:', message.type);

  if (message.type === 'PROCESS_TWEET_JSON_BULK') {
    handleProcessTweetJSONBulk(message.data, sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'SET_TWITTER_USER') {
    twitterUser = message.data;
    sendResponse({ success: true });
    return;
  }

  console.warn('Bookmark-X: Unknown message type:', message.type);
  sendResponse({ error: 'Unknown message type' });
  return;
});

async function handleProcessTweetJSONBulk(rawTweetData: any[], sendResponse: (response: any) => void) {
  try {
    // console.log(`Bookmark-X: Processing ${rawTweetData.length} raw tweets for user: ${twitterUser?.username}`);
    
    // Ensure we have Twitter user info
    if (!twitterUser) {
      throw new Error('Twitter user info not available');
    }
    
    // Convert and filter tweets
    const bookmarks = rawTweetData
      .map(processRawTweetData)
      .filter(bookmark => bookmark !== null);
    
    if (bookmarks.length === 0) {
      throw new Error('No valid tweets to import');
    }
    
    console.log(`Bookmark-X: Sending ${bookmarks.length} bookmarks to server...`);
    
    // Send to server for ML categorization and storage
    const response = await fetch(`${API_URL}/api/bookmarks/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookmarks: bookmarks,
        twitterUser: twitterUser
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server request failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const processedCount = result.stats?.imported || result.stats?.total || bookmarks.length;
    
    console.log(`Bookmark-X: Successfully processed ${processedCount} bookmarks`);
    
    // Mark installation as complete and redirect
    await completeInstallation();
    
    sendResponse({
      success: true,
      processedCount: processedCount
    });
    
  } catch (error: unknown) {
    console.error('Bookmark-X: Error processing tweets:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to the server'
    });
  }
}

async function completeInstallation() {
  // Clear the installation flag
  await chrome.storage.local.remove(['isNewInstall']);
  
  // Redirect to main site with twitter user ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    await chrome.tabs.update(tab.id, { 
      url: `${FRONTEND_URL}?source=extension&twitter_id=${twitterUser!.id}`
    });
  }
}

// Convert raw tweet data to ImportedBookmark format expected by server
function processRawTweetData(rawTweet: any): ImportedBookmark | null {
  try {
    if (!rawTweet.tweetId || !rawTweet.tweetText || !rawTweet.handle || !rawTweet.authorName) {
      console.warn('Bookmark-X: Missing required fields:', rawTweet);
      return null;
    }
    
    return {
      id: rawTweet.tweetId,
      text: rawTweet.tweetText,
      author_id: rawTweet.handle,
      created_at: rawTweet.time || new Date().toISOString(),
      media_attachments: rawTweet.media === 'has_media' ? [{ type: 'detected' }] : null,
      url: rawTweet.tweetUrl,
      author: {
        id: rawTweet.handle,
        name: rawTweet.authorName,
        username: rawTweet.handle,
        profile_image_url: rawTweet.profilePicture || null
      }
    };
  } catch (error: unknown) {
    console.error('Bookmark-X: Error processing raw tweet data:', error);
    return null;
  }
}