import React, { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import { useCategories } from "../hooks/useCategories";
import { useBookmarks } from "../hooks/useBookmarks";
import CategoryModal from "../components/bookmarks/CategoryModal";
import ImportBookmarks from "../components/bookmarks/ImportBookmarks";
import BookmarksGrid from "../components/bookmarks/BookmarksGrid";
import { Button } from "../components/ui/button";
import { Upload, RefreshCw } from "lucide-react";

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(true); // Start with import dialog open
  
  // Categories management
  const { 
    categories,
    isLoading: categoriesLoading
  } = useCategories();
  
  // State for selected category
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const selectedCategory = selectedCategoryId 
    ? categories.find(c => c.id === selectedCategoryId) 
    : undefined;
  
  // Bookmarks management
  const {
    bookmarks,
    allBookmarks,
    isLoading: bookmarksLoading,
    syncBookmarks,
    isSyncing,
    importBookmarks,
    isImporting,
    recategorizeBookmarks,
    isRecategorizing,
    updateCategory,
    isUpdatingCategory,
    deleteBookmark,
    isDeleting,
    selectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal
  } = useBookmarks(selectedCategoryId, searchQuery);

  // Loading state
  const isLoading = categoriesLoading || bookmarksLoading;

  // Calculate category counts from all bookmarks, not just filtered ones
  const categoryCount = allBookmarks.reduce((acc, bookmark) => {
    const categoryId = bookmark.categoryId || 0;
    acc[categoryId] = (acc[categoryId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Handler for selecting a category
  const selectCategory = (id: number) => {
    setSelectedCategoryId(id === selectedCategoryId ? undefined : id);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Import dialog handlers
  const openImportDialog = () => setShowImportDialog(true);
  const closeImportDialog = () => setShowImportDialog(false);
  
  const handleImport = (bookmarksData: any[]) => {
    importBookmarks(bookmarksData);
    closeImportDialog();
    // Ensure sidebar is visible after import on mobile
    setShowSidebar(true);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          categories={categories}
          selectedCategoryId={selectedCategoryId || 0}
          selectCategory={selectCategory}
          showSidebar={showSidebar}
          closeSidebar={() => setShowSidebar(false)}
          categoryCount={categoryCount}
          isLoading={isLoading}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with search and actions */}
          <header className="border-b p-4 flex items-center justify-between gap-2 bg-background">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="md:hidden"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
              <h1 className="text-xl font-semibold">
                {selectedCategory ? selectedCategory.name : 'All Bookmarks'}
                <span className="ml-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full px-3 py-1">
                  {selectedCategory 
                    ? (categoryCount[selectedCategory.id] || 0)
                    : Object.values(categoryCount).reduce((sum, count) => sum + count, 0)
                  }
                </span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-[200px]">
                <input
                  type="search"
                  placeholder="Search bookmarks..."
                  className="w-full p-2 pl-8 text-sm border rounded-md"
                  value={searchQuery}
                  onChange={handleSearch}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              
              <Button 
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={openImportDialog}
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                className="whitespace-nowrap"
                disabled={isRecategorizing}
                onClick={() => {
                  recategorizeBookmarks();
                  // Ensure sidebar is visible on mobile
                  setShowSidebar(true);
                }}
              >
                {isRecategorizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Recategorizing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Recategorize
                  </>
                )}
              </Button>
            </div>
          </header>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-4">
            <BookmarksGrid
              bookmarks={bookmarks}
              isLoading={isLoading || isRecategorizing}
              onChangeCategory={openCategoryModal}
              onDeleteBookmark={deleteBookmark}
            />
          </main>
        </div>

        {/* Category Modal */}
        {categoryModalOpen && selectedBookmark && (
          <CategoryModal 
            isOpen={categoryModalOpen} 
            onClose={closeModal}
            categories={categories}
            selectedBookmark={selectedBookmark}
            onSelectCategory={(categoryId) => updateCategory({ 
              bookmarkId: selectedBookmark.id, 
              categoryId 
            })}
            isUpdating={isUpdatingCategory}
          />
        )}

        {/* Import Dialog */}
        <ImportBookmarks
          isOpen={showImportDialog}
          onClose={closeImportDialog}
          onImport={handleImport}
          onRecategorize={recategorizeBookmarks}
          isImporting={isImporting}
          isRecategorizing={isRecategorizing}
        />
      </div>
    </div>
  );
}
