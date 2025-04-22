import React from "react";
import type { Bookmark, Category } from "../../lib/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import BookmarksGrid from "../bookmarks/BookmarksGrid";
import { Menu, Search, CalendarRange, RefreshCw } from "lucide-react";

interface MainContentProps {
  bookmarks: Bookmark[];
  isLoading: boolean;
  openSidebar: () => void;
  selectedCategory: Category | undefined;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  syncBookmarks: () => void;
  openCategoryModal: (bookmark: Bookmark) => void;
  deleteBookmark: (id: number) => void;
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
    <main className="flex-1 overflow-auto h-screen bg-gray-50 dark:bg-dark-100">
      {/* Top header bar */}
      <div className="border-b border-gray-200 dark:border-dark-300 bg-white dark:bg-dark-200 sticky top-0 z-20">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Button
              onClick={openSidebar}
              variant="ghost"
              size="icon"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-dark-300"
              aria-label="Open Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h2 className="ml-2 text-lg font-semibold">
              {selectedCategory?.name || "All Bookmarks"}
            </h2>
          </div>

          <div className="flex items-center">
            {/* Date filter button */}
            <div className="relative mr-2">
              <Button
                variant="outline"
                className="flex items-center bg-gray-100 dark:bg-dark-300 hover:bg-gray-200 dark:hover:bg-dark-400 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                Last 3 months
              </Button>
            </div>

            {/* Sync button */}
            <Button
              onClick={syncBookmarks}
              disabled={isLoading}
              variant="outline"
              className="mr-2 flex items-center bg-gray-100 dark:bg-dark-300 hover:bg-gray-200 dark:hover:bg-dark-400 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Syncing..." : "Sync Bookmarks"}
            </Button>

            {/* Search input */}
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
          </div>
        </div>
      </div>

      {/* Bookmarks container */}
      <div className="p-4 md:p-6">
        <BookmarksGrid 
          bookmarks={bookmarks} 
          isLoading={isLoading} 
          onChangeCategory={openCategoryModal}
          onDeleteBookmark={deleteBookmark}
        />
      </div>
    </main>
  );
}
