import React from "react";
import { Category } from "@shared/schema";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { getMaterialIcon } from "../../utils/categoryIcons";
import { Bookmark, X, Moon, LogOut } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface SidebarProps {
  categories: Category[];
  selectedCategoryId: number;
  selectCategory: (id: number) => void;
  showSidebar: boolean;
  closeSidebar: () => void;
  categoryCount: Record<number, number>;
  isLoading: boolean;
}

export default function Sidebar({
  categories,
  selectedCategoryId,
  selectCategory,
  showSidebar,
  closeSidebar,
  categoryCount,
  isLoading
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <aside
      className={`${
        showSidebar ? "translate-x-0" : "-translate-x-full"
      } w-64 bg-white dark:bg-dark-200 h-screen border-r border-gray-200 dark:border-dark-300 transition-transform duration-300 ease-in-out fixed lg:static z-30`}
    >
      <div className="p-4 border-b border-gray-200 dark:border-dark-300 flex items-center">
        <h1 className="text-xl font-bold text-twitterBlue flex items-center">
          <Bookmark className="h-5 w-5 mr-2" />
          Bookmark Organizer
        </h1>
        <Button
          onClick={closeSidebar}
          variant="ghost"
          size="icon"
          className="ml-auto p-1 rounded-full text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-dark-300"
          aria-label="Close Sidebar"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-4">
        <div className="mb-6">
          <h2 className="uppercase text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 tracking-wider">
            Categories
          </h2>

          {isLoading ? (
            // Loading skeleton for categories
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center px-3 py-2">
                  <Skeleton className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-6 ml-auto rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            // All Bookmarks category first
            <>
              <Button
                onClick={() => selectCategory(0)}
                variant="ghost"
                className={`flex items-center w-full px-3 py-2 rounded-lg mb-1 transition-colors text-left ${
                  selectedCategoryId === 0
                    ? "bg-gray-100 text-twitterBlue dark:bg-dark-300"
                    : "hover:bg-gray-50 dark:hover:bg-dark-300"
                }`}
              >
                <span className="text-gray-500 mr-2 flex items-center">{getMaterialIcon("widgets")}</span>
                All Bookmarks
                <span className="ml-auto bg-gray-200 dark:bg-dark-400 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                  {Object.values(categoryCount).reduce((sum, count) => sum + count, 0)}
                </span>
              </Button>

              {/* Regular categories */}
              {categories.map((category) => (
                <Button
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  variant="ghost"
                  className={`flex items-center w-full px-3 py-2 rounded-lg mb-1 transition-colors text-left ${
                    selectedCategoryId === category.id
                      ? "bg-gray-100 text-twitterBlue dark:bg-dark-300"
                      : "hover:bg-gray-50 dark:hover:bg-dark-300"
                  }`}
                >
                  <span 
                    className={`mr-2 flex items-center ${
                      category.name === "Content Ideas" ? "text-purple-500" :
                      category.name === "Automation Tools" ? "text-blue-500" :
                      category.name === "Interesting Reads" ? "text-green-500" :
                      category.name === "Career Tips" ? "text-orange-500" :
                      category.name === "Job Opportunities" ? "text-indigo-500" :
                      category.name === "Good Quotes" ? "text-yellow-500" :
                      category.name === "Knowledge/Trivia" ? "text-red-500" :
                      "text-gray-500"
                    }`}
                  >
                    {getMaterialIcon(category.icon)}
                  </span>
                  {category.name}
                  <span className="ml-auto bg-gray-200 dark:bg-dark-400 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                    {categoryCount[category.id] || 0}
                  </span>
                </Button>
              ))}
            </>
          )}
        </div>

        <Separator className="border-gray-200 dark:border-dark-300 my-4" />

        <div className="pt-2">
          <h2 className="uppercase text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 tracking-wider">
            Settings
          </h2>

          <div className="flex items-center px-3 py-2">
            <Label htmlFor="dark-mode" className="text-gray-700 dark:text-gray-300">
              <Moon className="h-4 w-4 inline mr-2" />
              Dark Mode
            </Label>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              className="ml-auto"
            />
          </div>

          <Button
            onClick={() => logout()}
            variant="ghost"
            className="flex items-center w-full px-3 py-2 rounded-lg mt-4 transition-colors text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
