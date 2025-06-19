import React, { useState, useCallback } from "react";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import { useCategories } from "../hooks/useCategories";
import { useBookmarks } from "../hooks/useBookmarks";
import { useDebounce } from "../hooks/useDebounce";
import CategoryModal from "../components/bookmarks/CategoryModal";
import type { Category } from "@shared/schema";

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState("");
  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebounce(searchInputValue, 500); // 500ms delay
  
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
    isLoading: bookmarksLoading,
    syncBookmarks,
    updateCategory,
    isUpdatingCategory,
    deleteBookmark,
    selectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal
  } = useBookmarks(selectedCategoryId, debouncedSearchQuery);

  const isLoading = categoriesLoading || bookmarksLoading;

  // Build category count map
  const categoryCount = categories.reduce((acc, category) => {
    // Use a default of 0 for each category
    acc[category.id] = 0;
    return acc;
  }, {} as Record<number, number>);

  // Handle search input change - memoized with useCallback
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        categories={categories as Category[]}
        selectedCategoryId={selectedCategoryId || 0}
        selectCategory={setSelectedCategoryId}
        showSidebar={showSidebar}
        closeSidebar={() => setShowSidebar(false)}
        categoryCount={categoryCount}
        isLoading={isLoading}
      />

      <MainContent
        bookmarks={bookmarks}
        isLoading={isLoading}
        openSidebar={() => setShowSidebar(true)}
        selectedCategory={selectedCategory}
        handleSearch={handleSearch}
        searchQuery={searchInputValue}
        syncBookmarks={syncBookmarks}
        openCategoryModal={openCategoryModal}
        deleteBookmark={(id: string) => deleteBookmark(Number(id))}
      />

      {selectedBookmark && (
        <CategoryModal 
          isOpen={categoryModalOpen} 
          onClose={closeModal}
          categories={categories}
          selectedBookmark={selectedBookmark}
          onSelectCategory={(categoryId) =>
            updateCategory({ bookmarkId: Number(selectedBookmark.id), categoryId })
          }
          isUpdating={isUpdatingCategory}
        />
      )}
    </div>
  );
}
