import { ReactNode } from "react";
import {
  Lightbulb,
  Wrench,
  BookOpen,
  Briefcase,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  Users,
  Brain,
  Microscope
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
    color: "",
  },
  "build": {
    name: "Automation Tools",
    icon: <Wrench size={16} />,
    color: "",
  },
  "psychology": {
    name: "Personal Reads",
    icon: <Brain size={16} />,
    color: "",
  },
  "science": {
    name: "Academic Research",
    icon: <Microscope size={16} />,
    color: "",
  },
  "work": {
    name: "Career Tips",
    icon: <Briefcase size={16} />,
    color: "",
  },
  "person_search": {
    name: "Job Opportunities",
    icon: <Users size={16} />,
    color: "",
  },

  "school": {
    name: "Knowledge/Trivia",
    icon: <GraduationCap size={16} />,
    color: "",
  },
  "help_outline": {
    name: "Uncategorized",
    icon: <HelpCircle size={16} />,
    color: "",
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
