// import React from "react";
import { Category } from "@shared/schema";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { getMaterialIcon } from "../../utils/categoryIcons";
import { X, Moon, LogOut, MessageCircle } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface SidebarProps {
  categories: Category[];
  selectedCategoryId: number;
  selectCategory: (id: number) => void;
  showSidebar: boolean;
  closeSidebar: () => void;
  categoryCounts: Record<number, number>;
  isLoading: boolean;
}

export default function Sidebar({
  categories,
  selectedCategoryId,
  selectCategory,
  showSidebar,
  closeSidebar,
  categoryCounts,
  isLoading
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <aside
      className={`${
        showSidebar ? "translate-x-0" : "-translate-x-full"
      } w-64 bg-white dark:bg-gray-900 h-screen border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out fixed z-30`}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
        <h1 className="text-2xl font-bold text-foreground flex items-center flex-1 min-w-0">
          <img 
            src="/generated-icon.png" 
            alt="Bookmark-X Logo" 
            className="h-10 w-10 mr-3 flex-shrink-0" 
          />
          <span className="truncate">Bookmark-X</span>
        </h1>
        <Button
          onClick={closeSidebar}
          variant="ghost"
          size="icon"
          className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Close Sidebar"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-4">
        <div className="mb-4">
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
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <span className="text-gray-500 dark:text-gray-400 mr-2 flex items-center">{getMaterialIcon("widgets")}</span>
                All Bookmarks
                <span className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                  {Object.values(categoryCounts).reduce((sum: number, count: number) => sum + count, 0)}
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
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  <span className="mr-2 flex items-center w-0">
                    {/* Empty space to maintain alignment with "All Bookmarks" */}
                  </span>
                  {category.name}
                  <span className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                    {categoryCounts[category.id] || 0}
                  </span>
                </Button>
              ))}
            </>
          )}
        </div>

        <Separator className="border-gray-200 dark:border-gray-800 my-3" />

        <div className="pt-1">
          {/* <h2 className="uppercase text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 tracking-wider">
            Settings
          </h2> */}

          {/* Chat with Bookmarks - Coming Soon */}
          <div className="mb-2">
          <div className="flex items-center px-3 py-2 opacity-70 cursor-not-allowed">
            <MessageCircle className="h-4 w-4 mr-2 text-gray-400" />
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 dark:text-gray-400">Chat with Bookmarks</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Coming soon...</span>
            </div>
          </div>
        </div>

        <Separator className="border-gray-200 dark:border-gray-800 my-3" />

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

          {/* <Link href="/privacy-policy">
            <Button
              variant="ghost"
              className="flex items-center w-full px-3 py-2 rounded-lg mt-2 transition-colors text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Shield className="h-4 w-4 mr-2" />
              Privacy Policy
            </Button>
          </Link> */}

          <Button
            onClick={() => logout()}
            variant="ghost"
            className="flex items-center w-full px-3 py-2 rounded-lg mt-4 transition-colors text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
