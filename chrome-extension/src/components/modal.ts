import { CollectedTweet as Tweet } from '../../../shared/schema';
import { cleanTwitterHtml } from '../../../shared/utils';

interface CarouselCard {
  tweet: Tweet;
  element: HTMLElement;
}

export class TweetCarousel {
  private container: HTMLElement;
  private cards: CarouselCard[] = [];
  private currentIndex = 0;
  private transitionInProgress = false;
  private intervalId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  addTweet(tweet: Tweet) {
    const card = this.createTweetCard(tweet);
    this.container.appendChild(card);
    this.cards.push({ tweet, element: card });

    if (this.cards.length === 1) {
      // First card should be visible immediately
      card.style.opacity = '1';
      card.style.transform = 'translateX(-50%) scale(1)';
    } else if (this.cards.length === 2) {
      // Start the carousel when we have at least 2 cards
      this.startCarousel();
    }
  }

  private createTweetCard(tweet: Tweet): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bookmarkbuddy-card';
    card.style.cssText = `
      position: absolute;
      left: 50%;
      top: 0;
      transform: translateX(-50%) scale(0.8);
      width: 500px;
      background: white;
      border-radius: 16px;
      padding: 50px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.5s ease;
      opacity: 0;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    `;

    const avatar = document.createElement('img');
    avatar.src = tweet.profilePicture;
    avatar.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 24px;
      margin-right: 12px;
    `;

    const authorInfo = document.createElement('div');
    authorInfo.style.cssText = `
      display: flex;
      flex-direction: column;
    `;

    const authorName = document.createElement('div');
    authorName.textContent = cleanTwitterHtml(tweet.authorName);
    authorName.style.cssText = `
      font-weight: 700;
      font-size: 16px;
      color: #0f172a;
    `;

    const handle = document.createElement('div');
    handle.textContent = `@${tweet.handle}`;
    handle.style.cssText = `
      font-size: 14px;
      color: #64748b;
    `;

    const content = document.createElement('div');
    content.textContent = tweet.tweetText;
    content.style.cssText = `
      font-size: 15px;
      line-height: 1.5;
      color: #1e293b;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    `;

    authorInfo.appendChild(authorName);
    authorInfo.appendChild(handle);
    header.appendChild(avatar);
    header.appendChild(authorInfo);
    card.appendChild(header);
    card.appendChild(content);

    return card;
  }

  private startCarousel() {
    if (this.intervalId !== null) return;
    
    this.intervalId = window.setInterval(() => {
      if (!this.transitionInProgress && this.cards.length > 1) {
        this.showNextCard();
      }
    }, 2000); // Change card every 2 seconds
  }

  private showNextCard() {
    if (this.transitionInProgress || this.cards.length < 2) return;
    this.transitionInProgress = true;

    const currentCard = this.cards[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.cards.length;
    const nextCard = this.cards[this.currentIndex];

    // Slide out current card
    currentCard.element.style.transform = 'translateX(-150%) scale(0.8)';
    currentCard.element.style.opacity = '0';

    // Slide in next card
    nextCard.element.style.transform = 'translateX(-50%) scale(1)';
    nextCard.element.style.opacity = '1';

    // Reset position of current card after animation
    setTimeout(() => {
      currentCard.element.style.transform = 'translateX(50%) scale(0.8)';
      this.transitionInProgress = false;
    }, 500);
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export function createLoadingModal() {
  const modal = document.createElement('div');
  modal.className = 'bookmarkbuddy-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  `;

  // Hide scrollbar when modal is open
  document.body.style.overflow = 'hidden';

  // Container for both carousel and progress text
  const contentContainer = document.createElement('div');
  contentContainer.style.cssText = `
    /* Arranges carousel and text vertically */
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 600px;
    /* Add padding to ensure space for absolutely positioned cards */
    padding: 20px;
  `;

  const carouselContainer = document.createElement('div');
  carouselContainer.className = 'bookmarkbuddy-carousel';
  carouselContainer.style.cssText = `
    position: relative;
    width: 100%;
    min-height: 220px;
    height: auto;
    perspective: 1000px;
    /* Contain absolutely positioned children */
    overflow: visible;
    /* Reserve space for cards */
    margin-bottom: 10px;
  `;

  const progressText = document.createElement('div');
  progressText.className = 'bookmarkbuddy-progress';
  progressText.style.cssText = `
    color: white;
    font-size: 18px;
    font-weight: 500;
    text-align: center;
    position: relative;
    z-index: 2;
    /* Ensure text has its own space */
    padding: 10px;
    margin-top: 20px;
  `;
  progressText.textContent = 'Collecting...';

  contentContainer.appendChild(carouselContainer);
  contentContainer.appendChild(progressText);
  modal.appendChild(contentContainer);

  // Restore scrolling when modal is removed
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && !document.querySelector('.bookmarkbuddy-modal')) {
        document.body.style.overflow = '';
        observer.disconnect();
      }
    });
  });
  
  observer.observe(document.body, { childList: true });

  return {
    modal,
    carouselContainer,
    progressText
  };
} 