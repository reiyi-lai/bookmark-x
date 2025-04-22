import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Upload, RefreshCw } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

interface ImportBookmarksProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (bookmarks: any[]) => void;
  onRecategorize: () => void;
  isImporting: boolean;
  isRecategorizing: boolean;
}

export default function ImportBookmarks({
  isOpen,
  onClose,
  onImport,
  onRecategorize,
  isImporting,
  isRecategorizing
}: ImportBookmarksProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/json") {
        setError("Please select a JSON file");
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    try {
      const fileContent = await file.text();
      const bookmarksData = JSON.parse(fileContent);
      
      // Check if it's a valid bookmarks file
      if (!bookmarksData || (
        !Array.isArray(bookmarksData) && 
        !Array.isArray(bookmarksData.data)
      )) {
        setError("Invalid bookmarks file format");
        return;
      }
      
      onImport(bookmarksData);
    } catch (error) {
      console.error("Error parsing file:", error);
      setError("Failed to parse JSON file. Please check the file format.");
    }
  };

  const handleRecategorize = () => {
    onRecategorize();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFile(null);
    setError(null);
  };

  const handleClose = () => {
    resetFileInput();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Twitter Bookmarks</DialogTitle>
          <DialogDescription>
            Upload a JSON file containing your Twitter bookmarks. We support two formats:
          </DialogDescription>
          <div className="mt-2">
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              <li>Twitter API format with full tweet metadata</li>
              <li>Simple array of strings with just the tweet text</li>
            </ul>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="bookmarks-file" className="text-sm font-medium">
              Select Bookmarks JSON File
            </label>
            <input
              ref={fileInputRef}
              id="bookmarks-file"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-primary file:text-primary-foreground file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              The file should contain tweets with text content for ML categorization
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="px-1 py-2">
            <h3 className="font-medium text-sm mb-2">After importing:</h3>
            <p className="text-xs text-muted-foreground">
              The ML categorizer will automatically organize your bookmarks. If you want to re-run the categorization on all bookmarks, use the Recategorize button.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleRecategorize} 
            variant="outline" 
            className="w-full sm:w-auto"
            disabled={isRecategorizing || isImporting}
          >
            {isRecategorizing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 
                Recategorizing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> 
                Recategorize All
              </>
            )}
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isImporting || isRecategorizing}
            className="w-full sm:w-auto"
          >
            {isImporting ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" /> 
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> 
                Import Bookmarks
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}