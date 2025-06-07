import { handleBulkBookmark } from '../tweet-collector';

// Check if we're on bookmarks page
function isBookmarksPage(): boolean {
  return window.location.pathname.includes('/i/bookmarks');
}

function findPageTitle(): Element | null {
  const titleElement = document.querySelector('h2[dir="ltr"][aria-level="2"][role="heading"]');
  if (titleElement?.textContent?.includes('Bookmarks')) {
    return titleElement;
  }
  return null;
}

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
  
  // Add hover effect
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

export function addSyncButton() {
  if (!isBookmarksPage()) {
    return;
  }

  // Check if button already exists
  if (document.querySelector('.bookmarkbuddy-header-btn')) {
    return;
  }

  const titleElement = findPageTitle();
  if (!titleElement) {
    requestAnimationFrame(addSyncButton);
    return;
  }

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

// UI Helper functions for the button
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

export function showNotification(message: string, type: 'success' | 'error') {
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