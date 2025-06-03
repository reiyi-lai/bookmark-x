console.log('BookmarkBuddy background script loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('BookmarkBuddy installed:', details.reason);
  
  if (details.reason === 'install') {
    // Automatically navigate to Twitter/X bookmarks page after installation
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

  if (message.type === 'GET_CATEGORIES') {
    handleGetCategories(sendResponse);
    return true;
  }

  console.warn('Unknown message type:', message.type);
  sendResponse({ error: 'Unknown message type' });
});

async function handleGetCategories(sendResponse: (response: any) => void) {
  try {
    console.log('BookmarkBuddy: Fetching categories from server...');
    
    const response = await fetch('http://localhost:5000/api/categories');
    
    if (!response.ok) {
      throw new Error(`Server request failed: ${response.status}`);
    }
    
    const categories = await response.json();
    
    console.log(`BookmarkBuddy: Retrieved ${categories.length} categories from server`);
    
    sendResponse({ success: true, categories });
  } catch (error) {
    console.error('BookmarkBuddy: Error getting categories from server:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get categories' 
    });
  }
}

async function handleProcessTweetJSONBulk(rawTweetData: any[], sendResponse: (response: any) => void) {
  try {
    console.log(`BookmarkBuddy: Processing ${rawTweetData.length} raw tweets...`);
    
    // Convert raw tweet data to the format expected by server
    const importedBookmarks = rawTweetData
      .map(processRawTweetData)
      .filter(bookmark => bookmark !== null);
    
    if (importedBookmarks.length === 0) {
      throw new Error('No valid tweets to import');
    }
    
    console.log(`BookmarkBuddy: Sending ${importedBookmarks.length} bookmarks to server for ML categorization and storage...`);
    
    // Send to server for ML categorization and storage
    const response = await fetch('http://localhost:5000/api/bookmarks/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookmarks: importedBookmarks
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Server request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log(`BookmarkBuddy: Server processed bookmarks successfully:`, result.stats);
    
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
      error: error instanceof Error ? error.message : 'Unknown error during processing'
    });
  }
}

// Convert raw tweet data to ImportedBookmark format expected by server
function processRawTweetData(rawTweet: any): any | null {
  try {
    if (!rawTweet.tweetId || !rawTweet.tweetText) {
      return null;
    }
    
    return {
      id: rawTweet.tweetId,
      text: rawTweet.tweetText,
      author_id: rawTweet.handle || 'unknown',
      created_at: rawTweet.time || new Date().toISOString(),
      author: {
        id: rawTweet.handle || 'unknown',
        name: rawTweet.authorName || 'Unknown Author',
        username: rawTweet.handle || 'unknown',
        profile_image_url: rawTweet.profilePicture || null
      }
    };
  } catch (error: unknown) {
    console.error('BookmarkBuddy: Error processing raw tweet data:', error);
    return null;
  }
}