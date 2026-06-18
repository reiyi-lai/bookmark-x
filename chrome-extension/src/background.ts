import type { ImportedBookmark } from '../../shared/schema';
import config from './config';

// Twitter user info received from content script
let twitterUser: { id: string; username: string } | null = null;

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ isNewInstall: true });

    await chrome.tabs.create({
      url: 'https://twitter.com/i/bookmarks'
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROCESS_TWEET_JSON_BULK') {
    handleProcessTweetJSONBulk(message.data, sendResponse);
    return true;
  }

  if (message.type === 'SET_TWITTER_USER') {
    twitterUser = message.data;
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'INJECT_COLLECTOR_SCRIPT') {
    handleInjectCollectorScript(sender, sendResponse);
    return true;
  }

  console.warn('Bookmark-X: Unknown message type:', message.type);
  sendResponse({ error: 'Unknown message type' });
  return;
});

async function handleInjectCollectorScript(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['js/tweet-collector-injection.js']
    });

    console.log('Bookmark-X: Injected collector script into tab', tabId);
    sendResponse({ success: true });
  } catch (error: unknown) {
    console.error('Bookmark-X: Failed to inject collector script:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Injection failed'
    });
  }
}

async function handleProcessTweetJSONBulk(rawTweetData: any[], sendResponse: (response: any) => void) {
  try {
    if (!twitterUser) {
      throw new Error('Twitter user info not available');
    }

    const bookmarks = rawTweetData
      .map(processRawTweetData)
      .filter(bookmark => bookmark !== null);

    if (bookmarks.length === 0) {
      throw new Error('No valid tweets to import');
    }

    console.log(`Bookmark-X: Sending ${bookmarks.length} bookmarks to server...`);

    const response = await fetch(`${config.apiUrl}/api/bookmarks/import`, {
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
  await chrome.storage.local.remove(['isNewInstall']);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    await chrome.tabs.update(tab.id, {
      url: `${config.frontendUrl}?source=extension&twitter_id=${twitterUser!.id}`
    });
  }
}

function processRawTweetData(rawTweet: any): ImportedBookmark | null {
  try {
    if (!rawTweet.tweetId) {
      console.warn('Bookmark-X: Missing tweetId:', JSON.stringify(rawTweet).substring(0, 200));
      return null;
    }

    const hasMedia = rawTweet.media === 'has_media';
    const rawText = typeof rawTweet.tweetText === 'string' ? rawTweet.tweetText.trim() : '';
    const text = rawText || (hasMedia ? '[Media-only bookmark]' : '');
    if (!text) {
      console.warn('Bookmark-X: Skipping tweet with no text and no media:', rawTweet.tweetId);
      return null;
    }

    return {
      id: rawTweet.tweetId,
      text,
      author_id: rawTweet.handle,
      created_at: rawTweet.time || new Date().toISOString(),
      media_attachments: hasMedia ? [{ type: 'detected' }] : null,
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
