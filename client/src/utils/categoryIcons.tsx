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

export const getCategoryBadgeClass = (categoryId: number, withHover: boolean = false): string => {
  const hoverClass = withHover ? ' hover:bg-opacity-20' : '';
  
  switch (categoryId) {
    case 1: // Content Ideas
      return `bg-purple-500/10 text-purple-500${hoverClass}`;
    case 2: // Automation Tools
      return `bg-blue-500/10 text-blue-500${hoverClass}`;
    case 4: // Career Tips
      return `bg-orange-500/10 text-orange-500${hoverClass}`;
    case 6: // Knowledge/Trivia
      return `bg-yellow-500/10 text-yellow-500${hoverClass}`;
    case 7: // Uncategorized
      return `bg-gray-500/10 text-gray-500${hoverClass}`;
    case 10: // Job Opportunities
      return `bg-indigo-500/10 text-indigo-500${hoverClass}`;
    case 11: // Personal Reads
      return `bg-pink-500/10 text-pink-500${hoverClass}`;
    case 12: // Academic Research
      return `bg-violet-500/10 text-violet-500${hoverClass}`;
    default:
      return `bg-gray-500/10 text-gray-500${hoverClass}`;
  }
};
