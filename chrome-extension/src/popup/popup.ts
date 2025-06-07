// Bookmark-X Chrome Extension Popup
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  setupEventListeners();
  await checkAuthState();
}

async function checkAuthState() {
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  
  try {
    // Check if we're on Twitter/X
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isTwitter = tab.url?.includes('twitter.com') || tab.url?.includes('x.com');
    
    if (!isTwitter) {
      showAuthSection('Please open Twitter/X to use Bookmark-X');
      return;
    }

    // Check if user is logged in
    const response = await chrome.tabs.sendMessage(tab.id!, { type: 'CHECK_TWITTER_AUTH' });
    
    if (!response?.isAuthenticated) {
      showAuthSection('Please sign in to Twitter/X');
      return;
    }

    // User is authenticated
    if (authSection) authSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    
    // Load dashboard data
    loadPopupData();
  } catch (error) {
    console.error('Error checking auth state:', error);
    showAuthSection('Error checking authentication status');
  }
}

function showAuthSection(message?: string) {
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const messageElement = document.querySelector('.auth-card p');
  
  if (messageElement && message) {
    messageElement.textContent = message;
  }
  
  if (authSection) authSection.style.display = 'block';
  if (dashboardSection) dashboardSection.style.display = 'none';
}

function setupEventListeners() {
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url?.includes('twitter.com') && !tab.url?.includes('x.com')) {
        // Redirect to Twitter login
        chrome.tabs.create({ url: 'https://x.com/i/flow/login', active: true });
      } else {
        // Refresh the current page
        chrome.tabs.reload(tab.id!);
      }
    });
  }
}

async function loadPopupData() {
  try {
    // Load settings
    const settings = await chrome.storage.local.get([
      'autoCategorizationEnabled',
      'totalBookmarks',
      'categoriesCount'
    ]);
    
    // Update UI with stored data
    const autoToggle = document.getElementById('autoCategorizationToggle') as HTMLInputElement;
    if (autoToggle) {
      autoToggle.checked = settings.autoCategorizationEnabled !== false;
    }
    
    // Update stats (placeholder values for now)
    const totalBookmarksEl = document.getElementById('totalBookmarks');
    if (totalBookmarksEl) {
      totalBookmarksEl.textContent = settings.totalBookmarks?.toString() || '0';
    }
    
    const categoriesCountEl = document.getElementById('categoriesCount');
    if (categoriesCountEl) {
      categoriesCountEl.textContent = settings.categoriesCount?.toString() || '6';
    }
    
  } catch (error) {
    console.error('Error loading popup data:', error);
  }
} 