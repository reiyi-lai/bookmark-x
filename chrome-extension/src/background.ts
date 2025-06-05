import type { ImportedBookmark } from '../../shared/schema';

console.log('BookmarkBuddy background script loaded');

const SERVER_URL = 'http://localhost:3000';

let twitterUser: { id: string; username: string } | null = null;

chrome.runtime.onInstalled.addListener((details) => {
  console.log('BookmarkBuddy installed:', details.reason);
  
  if (details.reason === 'install') {
    // Navigate to Twitter/X bookmarks page after installation
    chrome.tabs.create({ 
      url: 'https://x.com/i/bookmarks',
      active: true
    }).then(() => {
      console.log('BookmarkBuddy: Opened Twitter/X bookmarks page after installation');
    }).catch((error) => {
      console.error('BookmarkBuddy: Failed to open bookmarks page:', error);
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BookmarkBuddy: Received message:', message.type);

  if (message.type === 'PROCESS_TWEET_JSON_BULK') {
    handleProcessTweetJSONBulk(message.data, sendResponse);
    return true;
  }

  if (message.type === 'SET_TWITTER_USER') {
    twitterUser = message.data;
    sendResponse({ success: true });
    return;
  }

  console.warn('Unknown message type:', message.type);
  sendResponse({ error: 'Unknown message type' });
});

async function handleProcessTweetJSONBulk(rawTweetData: any[], sendResponse: (response: any) => void) {
  try {
    console.log(`BookmarkBuddy: Processing ${rawTweetData.length} raw tweets...`);
    
    // Convert raw tweet data to the format expected by server
    const bookmarks = rawTweetData
      .map(processRawTweetData)
      .filter(bookmark => bookmark !== null);
    
    if (bookmarks.length === 0) {
      throw new Error('No valid tweets to import');
    }
    
    console.log(`BookmarkBuddy: Sending ${bookmarks.length} bookmarks to server...`);
    
    // Send to server for ML categorization and storage
    const response = await fetch(`${SERVER_URL}/api/bookmarks/import`, {
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
    console.log(`BookmarkBuddy: Server processed bookmarks successfully:`, result.stats);
    
    // Redirect to main site after successful processing
    chrome.tabs.create({ 
      url: `${SERVER_URL}/?source=extension`,
      active: true 
    });
    
    sendResponse({
      success: true,
      processedCount: result.stats.total,
      savedCount: result.stats.imported,
      stats: result.stats
    });
    
  } catch (error: unknown) {
    console.error('BookmarkBuddy: Error in handleProcessTweetJSONBulk:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to the server'
    });
  }
}

// Convert raw tweet data to ImportedBookmark format expected by server
function processRawTweetData(rawTweet: any): ImportedBookmark | null {
  try {
    if (!rawTweet.tweetId || !rawTweet.tweetText || !rawTweet.handle || !rawTweet.authorName) {
      console.warn('BookmarkBuddy: Missing required fields:', rawTweet);
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
    console.error('BookmarkBuddy: Error processing raw tweet data:', error);
    return null;
  }
}