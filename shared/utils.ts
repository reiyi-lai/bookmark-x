// Clean HTML content from Twitter text (emojis, etc)
export function cleanTwitterHtml(htmlContent: string): string {
  if (!htmlContent) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  const result = Array.from(tempDiv.childNodes).map(node => {
      const element = node as HTMLElement;
      if (element.tagName === 'IMG') {
        return element.getAttribute('alt') || '';
      }
      if (element.tagName === 'SPAN') {
        return element.textContent || '';
      }
  }).join('');
  
  return result.trim();
} 