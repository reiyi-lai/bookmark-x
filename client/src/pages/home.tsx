import React, { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import { useCategories } from "../hooks/useCategories";
import { useBookmarks } from "../hooks/useBookmarks";
import CategoryModal from "../components/bookmarks/CategoryModal";
import type { Category } from "@shared/schema";

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
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
    updateCategory,
    isUpdatingCategory,
    deleteBookmark,
    selectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal
  } = useBookmarks(selectedCategoryId, searchQuery);

  const isLoading = categoriesLoading || bookmarksLoading;

  const categoryCount = allBookmarks.reduce((acc, bookmark) => {
    const categoryId = bookmark.categoryId || 0;
    acc[categoryId] = (acc[categoryId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Handle search input change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

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
        searchQuery={searchQuery}
        syncBookmarks={syncBookmarks}
        openCategoryModal={openCategoryModal}
        deleteBookmark={deleteBookmark}
      />

      {selectedBookmark && (
        <CategoryModal 
          isOpen={categoryModalOpen} 
          onClose={closeModal}
          categories={categories}
          selectedBookmark={selectedBookmark}
          onSelectCategory={(categoryId) =>
            updateCategory({ bookmarkId: selectedBookmark.id, categoryId })
          }
          isUpdating={isUpdatingCategory}
        />
      )}
    </div>
  );
}
