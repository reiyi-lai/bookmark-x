import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Category, ClientBookmark as Bookmark } from "@shared/schema";
import { getCategoryBadgeClass } from "../../utils/categoryIcons";
import { RefreshCw } from "lucide-react";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  selectedBookmark: Bookmark;
  onSelectCategory: (categoryId: number) => void;
  isUpdating: boolean;
}

export default function CategoryModal({
  isOpen,
  onClose,
  categories,
  selectedBookmark,
  onSelectCategory,
  isUpdating
}: CategoryModalProps) {


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Category</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Bookmark Content</h3>
            <p className="text-sm border rounded-md p-3 bg-muted/50">
              {selectedBookmark?.content || "No content available"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              By @{selectedBookmark?.authorUsername || "unknown"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Select Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant="outline"
                  className={`justify-start h-auto py-2 ${
                    selectedBookmark?.categoryId === category.id
                      ? "border-primary"
                      : ""
                  }`}
                  onClick={() => onSelectCategory(category.id)}
                  disabled={isUpdating}
                >
                  <Badge
                    variant="outline"
                    className={`mr-2 ${getCategoryBadgeClass(category.id, true)}`}
                  >
                    {/* Show a checkmark if this is the current category */}
                    {selectedBookmark?.categoryId === category.id ? "✓" : ""}
                  </Badge>
                  <span className="truncate">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          {isUpdating && (
            <Button disabled>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}