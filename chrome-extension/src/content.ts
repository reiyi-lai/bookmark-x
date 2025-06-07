import { addSyncButton } from './components/sync-button';
import { handleBulkBookmark } from './tweet-collector';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBookmarkBuddy);
} else {
  initializeBookmarkBuddy();
}

async function initializeBookmarkBuddy() {
  // Check if this is a fresh installation
  const { isNewInstall } = await chrome.storage.local.get(['isNewInstall']);
  
  if (isNewInstall) {
    await handleBulkBookmark();
  }
  
  // addSyncButton() handles check for x.com bookmarks page
  addSyncButton();
  
  setupUrlWatcher();
}

function setupUrlWatcher() {
  // Watch for URL changes to re-add sync button
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(addSyncButton, 500);
    }
  });
  
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
} 