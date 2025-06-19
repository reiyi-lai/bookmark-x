import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { LazyImage } from "../ui/lazy-image";
import type { ClientBookmark as Bookmark } from "@shared/schema";
import { cleanTwitterHtml } from "@shared/utils";
import { CalendarIcon, Tag, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useCategories } from "../../hooks/useCategories";
import { memo, useMemo } from "react";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onChangeCategory: () => void;
  onDelete: () => void;
}

function BookmarkCard({
  bookmark,
  onChangeCategory,
  onDelete
}: BookmarkCardProps) {
  // Get categories data
  const { categories } = useCategories();
  
  const formattedDate = format(new Date(bookmark.createdAt), "MMM d, yyyy");
  
  // Memoize category name lookup
  const categoryName = !bookmark.categoryId 
    ? 'Uncategorized' 
    : categories.find(c => c.id === bookmark.categoryId)?.name || 'Uncategorized';
  
  // Fallback for profile picture - memoized to avoid recalculation
  const initials = useMemo(() => {
    const name = cleanTwitterHtml(bookmark.authorName || '');
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }, [bookmark.authorName]);

  // Memoize category badge class to avoid recalculation on each render
  const categoryBadgeClass = useMemo(() => {
    if (!bookmark.categoryId) return 'bg-gray-500/10 text-gray-500';
    
    const categoryId = bookmark.categoryId;
    
    switch (categoryId) {
      case 1: // Content Ideas
        return 'bg-blue-500/10 text-blue-500';
      case 2: // Automation Tools
        return 'bg-purple-500/10 text-purple-500';
      case 3: // Interesting Reads
        return 'bg-amber-500/10 text-amber-500';
      case 4: // Career Tips
        return 'bg-green-500/10 text-green-500';
      case 5: // Quotes
        return 'bg-pink-500/10 text-pink-500';
      case 6: // General Knowledge/Trivia
        return 'bg-indigo-500/10 text-indigo-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  }, [bookmark.categoryId]);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-10 w-10">
            {bookmark.authorProfileImage ? (
              <LazyImage 
                src={bookmark.authorProfileImage} 
                alt={bookmark.authorName || ''}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <AvatarFallback>{initials}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h3 className="font-semibold">{cleanTwitterHtml(bookmark.authorName || '')}</h3>
            <p className="text-sm text-muted-foreground">@{bookmark.authorUsername || ''}</p>
          </div>
        </div>
        
        <p className="text-sm mb-3 line-clamp-3">{bookmark.content}</p>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <CalendarIcon className="h-3 w-3" />
          <span>{formattedDate}</span>
        </div>
      </CardContent>
      
      <CardFooter className="p-3 pt-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Badge 
            variant="outline" 
            className={`cursor-pointer ${categoryBadgeClass}`}
            onClick={onChangeCategory}
          >
            <Tag className="h-3 w-3 mr-1" />
            <span className="truncate max-w-[100px]">{categoryName}</span>
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(bookmark.url, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">Open tweet</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive/90"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default memo(BookmarkCard, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.bookmark.id === nextProps.bookmark.id &&
    prevProps.bookmark.categoryId === nextProps.bookmark.categoryId &&
    prevProps.bookmark.content === nextProps.bookmark.content
  );
});