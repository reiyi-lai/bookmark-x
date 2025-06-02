console.log('BookmarkBuddy background script loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('BookmarkBuddy installed:', details.reason);
  
  if (details.reason === 'install') {
    // Default settings on install
    chrome.storage.local.set({
      autoCategorizationEnabled: true,
      defaultCategory: 'Uncategorized',
      lastSyncTime: null
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
    // TODO: Replace with Supabase integration
    const mockCategories = [
      { id: '1', name: 'Tech', description: 'Technology tweets' },
      { id: '2', name: 'News', description: 'News and current events' },
      { id: '3', name: 'Personal', description: 'Personal thoughts and updates' }
    ];
    
    sendResponse({ success: true, categories: mockCategories });
  } catch (error) {
    console.error('Error getting categories:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get categories' 
    });
  }
}

async function handleProcessTweetJSONBulk(rawTweetData: any[], sendResponse: (response: any) => void) {
  try {
    console.log(`BookmarkBuddy: Processing ${rawTweetData.length} raw tweets...`);
    
    const processedTweets: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const rawTweet of rawTweetData) {
      try {
        const processedTweet = processRawTweetData(rawTweet);
        if (processedTweet) {
          processedTweets.push(processedTweet);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error: unknown) {
        console.error('BookmarkBuddy: Error processing individual tweet:', error);
        errorCount++;
      }
    }
    
    console.log(`BookmarkBuddy: Processing complete. Success: ${successCount}, Errors: ${errorCount}`);
    
    // TODO: Send processed tweets to Supabase/backend
    console.log('BookmarkBuddy: Sample processed tweets:', processedTweets.slice(0, 3));
    
    sendResponse({
      success: true,
      processedCount: successCount,
      errorCount: errorCount,
      data: processedTweets // You can remove this in production to save memory
    });
    
  } catch (error: unknown) {
    console.error('BookmarkBuddy: Error in handleProcessTweetJSONBulk:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Process individual raw tweet data into structured format
function processRawTweetData(rawTweet: any): any | null {
  try {
    if (!rawTweet.tweetId || !rawTweet.tweetUrl) {
      return null;
    }
    
    const processedDate = processTimestamp(rawTweet.time);
    
    return {
      tweetId: rawTweet.tweetId,
      url: rawTweet.tweetUrl,
      content: rawTweet.tweetText,
      author: rawTweet.handle || '',
      authorDisplayName: rawTweet.authorName || '',
      authorProfilePicture: rawTweet.profilePicture || '',
      tweetDate: processedDate,
      bookmarkedAt: new Date().toISOString(),
      mediaAttachments: rawTweet.media === 'has_media' ? [{ type: 'detected', detected: true }] : null,
      
      userId: null, // Set after authentication
      tags: [], // Set by AI categorization later
      category: null // Set by AI categorization
    };
  } catch (error: unknown) {
    console.error('BookmarkBuddy: Error processing raw tweet data:', error);
    return null;
  }
}

function processTimestamp(timestamp: string): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}