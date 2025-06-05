import React from "react";
import type { ClientBookmark as Bookmark, Category } from "@shared/schema";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import BookmarksGrid from "../bookmarks/BookmarksGrid";
import { Menu, Search, RefreshCw } from "lucide-react";

interface MainContentProps {
  bookmarks: Bookmark[];
  isLoading: boolean;
  openSidebar: () => void;
  selectedCategory: Category | undefined;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  syncBookmarks: () => void;
  openCategoryModal: (bookmark: Bookmark) => void;
  deleteBookmark: (id: string) => void;
}

export default function MainContent({
  bookmarks,
  isLoading,
  openSidebar,
  selectedCategory,
  handleSearch,
  searchQuery,
  syncBookmarks,
  openCategoryModal,
  deleteBookmark
}: MainContentProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with search and actions */}
      <header className="border-b p-4 flex items-center justify-between gap-2 bg-background">
        <div className="flex items-center gap-2">
              <Button
                variant="outline"
            size="sm"
            onClick={openSidebar}
            className="md:hidden"
              >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
              </Button>
          <h1 className="text-xl font-semibold">
            {selectedCategory ? selectedCategory.name : 'All Bookmarks'}
            <span className="ml-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full px-3 py-1">
              {bookmarks.length}
            </span>
          </h1>
            </div>

        <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-dark-300 bg-gray-100 dark:bg-dark-300 focus:outline-none focus:ring-2 focus:ring-twitterBlue dark:focus:ring-opacity-50 w-56 transition-colors"
              />
            </div>

          <Button
            onClick={syncBookmarks}
            disabled={isLoading}
            variant="outline"
            className="flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </header>

      {/* Bookmarks container */}
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <BookmarksGrid 
          bookmarks={bookmarks} 
          isLoading={isLoading} 
          onChangeCategory={openCategoryModal}
          onDeleteBookmark={deleteBookmark}
        />
      </div>
    </div>
  );
}
