import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Tweet card data from CSV
const tweetData = [
  {
    id: "fa057c4e-1ef4-4464-9847-0b90c9c55f54",
    authorName: "Sonith",
    authorUsername: "_sonith",
    authorProfileImage: "https://unavatar.io/twitter/_sonith",
    content: "Every single person I've interviewed thus far, even those working with billions of dollars, have all sent cold emails. Not one. Not two. But many. It's low ego and how you get things done.. until you have the privilege to get intros.",
    createdAt: "2025-03-13 01:50:35+00",
    categoryId: 4
  },  
  {
    id: "231b0a70-8785-49bc-afa7-844df8cad649",
    authorName: "blue",
    authorUsername: "bluewmist",
    authorProfileImage: "https://unavatar.io/twitter/bluewmist",
    content: "The problem is, you think you have time... Most of us get around 80 summers, if we're lucky. Don't wait. Life isn't something that starts later. Say yes to the trip. Start the project. Write the book. Take the risk. Chase the dream. Spend time with those you love.",
    createdAt: "2025-06-19 03:45:24+00",
    categoryId: 4
  },
  {
    id: "df353688-9c1c-40f0-86aa-d5f22ae21f35",
    authorName: "Roy",
    authorUsername: "im_roy_lee",
    authorProfileImage: "https://unavatar.io/twitter/im_roy_lee",
    content: "humility has killed 1,000x more companies than ego",
    createdAt: "2025-06-20 02:59:59+00",
    categoryId: 4
  }
];

// Animation constants - now responsive
const DESKTOP_ANIMATION_INTERVAL = 450; // Time between transitions
const MOBILE_ANIMATION_INTERVAL = 400; // Faster on mobile
const TRANSITION_DURATION = 350; // Animation duration
const DASHBOARD_EXPAND_DURATION = 1300; // Duration of dashboard expansion

// Custom hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

// Animated background bookmark card component
const BookmarkCard = ({ delay, rotate, scale, x, y }: { 
  delay: number; 
  rotate: number; 
  scale: number; 
  x: number; 
  y: number;
}) => {
  return (
    <motion.div
      className="absolute w-64 h-32 bg-white rounded-lg shadow-md p-4"
      initial={{ opacity: 0, scale: 0.8, x, y, rotate }}
      animate={{ 
        opacity: [0, 0.7, 0.5], 
        scale: [scale * 0.8, scale], 
        x: [x, x + 20, x - 20, x],
        y: [y, y - 20, y + 10, y],
        rotate: [rotate, rotate + 5, rotate - 3, rotate]
      }}
      transition={{
        delay,
        duration: 15,
        repeat: Infinity,
        repeatType: "reverse",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-500/20"></div>
        <div>
          <div className="h-3 w-24 bg-gray-200 rounded"></div>
          <div className="h-2 w-16 bg-gray-100 rounded mt-1"></div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full bg-gray-100 rounded"></div>
        <div className="h-2 w-5/6 bg-gray-100 rounded"></div>
        <div className="h-2 w-4/6 bg-gray-100 rounded"></div>
      </div>
      <div className="flex justify-between items-center mt-3">
        <div className="h-4 w-16 bg-blue-100 rounded-full"></div>
        <div className="h-4 w-4 rounded-full bg-gray-100"></div>
      </div>
    </motion.div>
  );
};

// Tweet card component for the carousel
const TweetCard = ({ tweet, status, isMobile }: { 
  tweet: typeof tweetData[0]; 
  status: 'entering' | 'active' | 'exiting' | 'inactive';
  isMobile: boolean;
}) => {
  // Determine animation properties based on status
  let position = {};
  
  switch (status) {
    case 'entering':
      position = { opacity: 1, x: "-50%", scale: 1 };
      break;
    case 'active':
      position = { opacity: 1, x: "-50%", scale: 1 };
      break;
    case 'exiting':
      position = { opacity: 0, x: "-150%", scale: 0.8 };
      break;
    case 'inactive':
      position = { opacity: 0, x: "50%", scale: 0.8 };
      break;
  }

  return (
    <motion.div
      className={`absolute left-1/2 top-0 bg-white rounded-2xl shadow-lg flex flex-col justify-center ${
        isMobile 
          ? 'w-[90vw] max-w-[400px] min-h-[200px] p-6' 
          : 'w-[500px] min-h-[250px] p-12'
      }`}
      initial={{ opacity: 0, x: "50%", scale: 0.8 }}
      animate={position}
      transition={{ 
        duration: TRANSITION_DURATION / 1000, // Convert to seconds
        ease: [0.4, 0, 0.2, 1] // cubic-bezier(0.4, 0, 0.2, 1)
      }}
    >
      <div className={`flex items-center ${isMobile ? 'mb-2' : 'mb-3'}`}>
        <div className={`rounded-full overflow-hidden mr-3 ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
          <img 
            src={tweet.authorProfileImage}
            alt={tweet.authorName}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='5'/%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3C/svg%3E";
            }}
          />
        </div>
        <div>
          <div className={`font-bold text-gray-900 ${isMobile ? 'text-sm' : 'text-base'}`}>{tweet.authorName}</div>
          <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>@{tweet.authorUsername}</div>
        </div>
      </div>
      <div className={`text-gray-800 line-clamp-4 ${isMobile ? 'text-sm leading-5' : 'text-[15px] leading-6'}`}>
        {tweet.content}
      </div>
    </motion.div>
  );
};

// Dashboard preview component
const DashboardPreview = ({ status, isExpanding, onExpand, isMobile }: { 
  status: 'entering' | 'active' | 'exiting' | 'inactive';
  isExpanding: boolean;
  onExpand: () => void;
  isMobile: boolean;
}) => {
  // Determine animation properties based on status
  let position = {};
  
  if (isExpanding) {
    // When expanding, we'll animate this component to full screen first
    // then trigger the background expansion and fade this out
    position = { 
      opacity: [1, 0],
      x: "-50%",
      scale: [1, 1.2],
      zIndex: 10
    };
    
    // Trigger the background expansion with a slight delay
    setTimeout(() => {
      onExpand();
    }, 10);
  } else {
    switch (status) {
      case 'entering':
        position = { opacity: 1, x: "-50%", scale: 1, zIndex: 10 };
        break;
      case 'active':
        position = { opacity: 1, x: "-50%", scale: 1, zIndex: 10 };
        break;
      case 'exiting':
        position = { opacity: 0, x: "-150%", scale: 0.8, zIndex: 5 };
        break;
      case 'inactive':
        position = { opacity: 0, x: "50%", scale: 0.8, zIndex: 1 };
        break;
    }
  }

  return (
    <motion.div
      className={`absolute left-1/2 top-0 bg-white rounded-2xl shadow-lg overflow-hidden origin-center ${
        isMobile ? 'w-[90vw] max-w-[400px]' : 'w-[500px]'
      }`}
      initial={{ opacity: 0, x: "50%", scale: 0.8, zIndex: 1 }}
      animate={position}
      transition={isExpanding ? 
        { 
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1]
        } : { 
          duration: TRANSITION_DURATION / 1000,
          ease: [0.4, 0, 0.2, 1]
        }
      }
    >
      <img 
        src="/bookmarkx-landing.png" 
        alt="Bookmark-X Dashboard" 
        className="w-full h-auto"
      />
    </motion.div>
  );
};

export default function LandingPage() {
  const isMobile = useIsMobile();
  const animationInterval = isMobile ? MOBILE_ANIMATION_INTERVAL : DESKTOP_ANIMATION_INTERVAL;
  
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [previousIndex, setPreviousIndex] = useState(-1);
  const [transitionInProgress, setTransitionInProgress] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [carouselStopped, setCarouselStopped] = useState(false);
  const [backgroundFullyExpanded, setBackgroundFullyExpanded] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [buttonsLayer, setButtonsLayer] = useState(1000); // Very high z-index for buttons
  
  // Ensure animations start after component mount
  useEffect(() => {
    setMounted(true);
    
    // Start the carousel after a short delay
    const timer = setTimeout(() => {
      if (!carouselStopped) {
        setCurrentIndex(0);
      }
    }, 250);
    
    return () => clearTimeout(timer);
  }, [carouselStopped]);
  
  // Handle carousel transitions
  useEffect(() => {
    if (currentIndex === -1 || carouselStopped) return;
    
    const interval = setInterval(() => {
      if (!transitionInProgress) {
        setTransitionInProgress(true);
        setPreviousIndex(currentIndex);
        
        // Move to next item or stay on dashboard
        setCurrentIndex(prev => {
          return prev < tweetData.length ? prev + 1 : prev;
        });
        
        // Reset transition state after animation completes
        setTimeout(() => {
          setTransitionInProgress(false);
          
          // If we've reached the dashboard, trigger expansion immediately
          if (currentIndex === tweetData.length) {
            setDashboardExpanded(true);
            // Stop the carousel once dashboard is expanded
            setCarouselStopped(true);
          }
        }, TRANSITION_DURATION);
      }
    }, animationInterval);
    
    return () => clearInterval(interval);
  }, [currentIndex, transitionInProgress, carouselStopped]);

  // Get card status based on indices
  const getCardStatus = (index: number) => {
    if (index === currentIndex) return 'entering';
    if (index === previousIndex) return 'exiting';
    if (index < currentIndex) return 'inactive';
    return 'inactive';
  };

  // Handle dashboard expansion
  const handleDashboardExpand = () => {
    setShowBackground(true);
    
    // Mark background as fully expanded after animation completes
    setTimeout(() => {
      setBackgroundFullyExpanded(true);
    }, DASHBOARD_EXPAND_DURATION);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Main content - lower z-index */}
      <div className="relative flex flex-col items-center justify-center h-full px-4 text-center text-white" style={{ zIndex: backgroundFullyExpanded ? 10 : 1 }}>
        <div className="mb-4 md:mb-6 flex items-center">
          <motion.img 
            src="/generated-icon.png" 
            alt="Bookmark-X Logo" 
            className={`mr-3 ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <h1 className={`font-bold ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
            Bookmark<span className="text-blue-600">X</span>
          </h1>
        </div>

        <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6 max-w-2xl px-4">
          Your smart knowledge base for Twitter bookmarks
        </h2>

        {/* Tweet Carousel and Dashboard Preview */}
        <div 
          className={`w-full max-w-4xl relative mb-0 ${isMobile ? 'h-[200px]' : 'h-[300px]'}`} 
          ref={carouselRef} 
          style={{ pointerEvents: "none" }}
        >
          {/* Render all tweet cards with appropriate status */}
          {tweetData.map((tweet, index) => (
            <TweetCard 
              key={tweet.id} 
              tweet={tweet} 
              status={getCardStatus(index)}
              isMobile={isMobile}
            />
          ))}
          
          {/* Dashboard with appropriate status */}
          <DashboardPreview 
            status={getCardStatus(tweetData.length)}
            isExpanding={dashboardExpanded}
            onExpand={handleDashboardExpand}
            isMobile={isMobile}
          />
        </div>

        {/* CTA Buttons - Positioned with highest z-index but keeping original layout */}
        <div className="relative" style={{ zIndex: buttonsLayer, pointerEvents: "auto" }}>
          <motion.div 
            className="flex flex-col sm:flex-row gap-3 md:gap-4 items-center px-4"
            initial={{ y: isMobile ? 5 : 15, opacity: 1 }}
            animate={{ 
              y: dashboardExpanded ? (isMobile ? -150 : -200) : (isMobile ? 5 : 15),
              opacity: 1
            }}
            transition={{ 
              duration: 1,
              ease: "easeInOut",
              delay: dashboardExpanded ? 0.2 : 0
            }}
          >
            <motion.a 
              href="https://chromewebstore.google.com/detail/bookmark-x/bejljpjhkmiimkpompiinllbhjghkpmd" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`bg-blue-600 text-white rounded-full font-medium shadow-lg hover:bg-blue-700 transition-colors flex items-center ${
                isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className={`mr-2 fill-none stroke-current ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add to Chrome
            </motion.a>
            
            <motion.button 
              className={`border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors bg-white ${
                isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Log In
            </motion.button>
          </motion.div>
        </div>
      </div>
      
      {/* Animated background cards - hidden on mobile */}
      {!isMobile && (
        <div className="absolute inset-0 opacity-30 overflow-hidden" style={{ zIndex: backgroundFullyExpanded ? 2 : 3, pointerEvents: "none" }}>
          {mounted && (
            <>
              <BookmarkCard delay={0} rotate={-5} scale={0.9} x={-100} y={-150} />
              <BookmarkCard delay={2} rotate={8} scale={0.7} x={300} y={-80} />
              <BookmarkCard delay={4} rotate={-12} scale={0.8} x={-250} y={200} />
              <BookmarkCard delay={6} rotate={3} scale={0.6} x={400} y={300} />
              <BookmarkCard delay={8} rotate={-8} scale={0.75} x={100} y={400} />
              <BookmarkCard delay={10} rotate={15} scale={0.65} x={-300} y={350} />
            </>
          )}
        </div>
      )}
      
      {/* Background layers - highest z-index during expansion, lowest after */}
      {showBackground && (
        <motion.div 
          className="fixed inset-0 w-full h-full"
          initial={{ 
            opacity: 1,
            scale: 0.5
          }}
          animate={{ 
            opacity: backgroundFullyExpanded ? 0.15 : 1,
            scale: 1
          }}
          transition={{ 
            duration: DASHBOARD_EXPAND_DURATION / 1000,
            ease: [0.4, 0, 0.2, 1]
          }}
          style={{
            backgroundImage: "url('/bookmarkx-preview.png')",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            transformOrigin: "center center",
            pointerEvents: "none", // This allows clicks to pass through
            zIndex: backgroundFullyExpanded ? 0 : 100 // Highest during expansion, lowest after
          }}
        />
      )}
    </div>
  );
} 