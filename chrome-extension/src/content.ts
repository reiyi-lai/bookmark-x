import { addSyncButton } from './components/sync-button';
import { handleBulkBookmark, ensureCollectorInjected } from './tweet-collector';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBookmarkBuddy);
} else {
  initializeBookmarkBuddy();
}

async function initializeBookmarkBuddy() {
  // Inject the MAIN world collector early on the bookmarks page
  // so it can prebuffer GraphQL responses before the user clicks sync
  if (window.location.pathname.includes('/i/bookmarks')) {
    ensureCollectorInjected();
  }

  const { isNewInstall } = await chrome.storage.local.get(['isNewInstall']);

  if (isNewInstall) {
    await handleBulkBookmark();
  }

  addSyncButton();

  setupUrlWatcher();
}

function setupUrlWatcher() {
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      if (currentUrl.includes('/i/bookmarks')) {
        ensureCollectorInjected();
      }
      setTimeout(addSyncButton, 500);
    }
  });
  
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
} 