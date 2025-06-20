import React, { useState, useCallback, useEffect } from "react";
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
    categoryCounts,
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
  
  // Handle search input change - memoized with useCallback
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  }, []);

  // Optimize category switching by scrolling to top
  useEffect(() => {
    // When category changes, scroll to top for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCategoryId]);

  // Handle category selection with optimized UX
  const handleCategorySelect = useCallback((categoryId: number) => {
    // If on mobile, close the sidebar after category selection
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
    setSelectedCategoryId(categoryId);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        categories={categories as Category[]}
        selectedCategoryId={selectedCategoryId || 0}
        selectCategory={handleCategorySelect}
        showSidebar={showSidebar}
        closeSidebar={() => setShowSidebar(false)}
        categoryCounts={categoryCounts}
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
        deleteBookmark={deleteBookmark}
        categoryCounts={categoryCounts}
      />

      {selectedBookmark && (
        <CategoryModal 
          isOpen={categoryModalOpen} 
          onClose={closeModal}
          categories={categories}
          selectedBookmark={selectedBookmark}
          onSelectCategory={(categoryId) =>
            updateCategory({ bookmarkId: selectedBookmark.id.toString(), categoryId })
          }
          isUpdating={isUpdatingCategory}
        />
      )}
    </div>
  );
}
