import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "../../hooks/use-toast";

interface EmailSignupModalProps {
  isOpen: boolean;
  onSubmit: (email: string) => Promise<void>;
  onClose: () => void;
}

export function EmailSignupModal({ isOpen, onSubmit, onClose }: EmailSignupModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic email validation
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(email);
      toast({
        title: "Success!",
        description: "Your email has been registered successfully.",
      });
      onClose();
    } catch (error) {
      // Error handling by EmailSignupHandler - just keep modal open
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={true}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Enter your email to save your bookmarks!</DialogTitle>
          {/* <DialogDescription>
            This is so you can save and access your organized bookmarks.
          </DialogDescription> */}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isLoading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 