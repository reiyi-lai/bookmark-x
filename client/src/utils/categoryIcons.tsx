import { ReactNode } from "react";
import {
  Lightbulb,
  Wrench,
  BookOpen,
  Briefcase,
  Quote,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  Users
} from "lucide-react";

export interface CategoryIcon {
  name: string;
  icon: ReactNode;
  color: string;
}

export const categoryIcons: Record<string, CategoryIcon> = {
  "lightbulb": {
    name: "Content Ideas",
    icon: <Lightbulb size={16} />,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  "build": {
    name: "Automation Tools",
    icon: <Wrench size={16} />,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  "menu_book": {
    name: "Interesting Reads",
    icon: <BookOpen size={16} />,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  "work": {
    name: "Career Tips",
    icon: <Briefcase size={16} />,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  "person_search": {
    name: "Job Opportunities",
    icon: <Users size={16} />,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  "format_quote": {
    name: "Good Quotes",
    icon: <Quote size={16} />,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  "school": {
    name: "Knowledge/Trivia",
    icon: <GraduationCap size={16} />,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  "help_outline": {
    name: "Uncategorized",
    icon: <HelpCircle size={16} />,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
  "widgets": {
    name: "All Bookmarks",
    icon: <LayoutGrid size={16} />,
    color: "",
  },
};

export const getMaterialIcon = (iconName: string): ReactNode => {
  const iconComponent = categoryIcons[iconName]?.icon;
  
  if (iconComponent) {
    return iconComponent;
  }
  
  // Fallback to a span with Material Icons class
  return (
    <span className="material-icons text-xs mr-1">{iconName}</span>
  );
};

export const getCategoryBadgeClass = (iconName: string): string => {
  return categoryIcons[iconName]?.color || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
};
