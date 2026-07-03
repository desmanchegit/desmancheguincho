import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { startTour, type TourRole } from "@/lib/tour";
import { startAdminFullTour } from "@/lib/adminTour";
import { startDesmancheFullTour } from "@/lib/desmancheTour";

interface TourHelpButtonProps {
  userId: string;
  role: TourRole;
}

function handleTourStart(userId: string, role: TourRole) {
  if (role === "admin") {
    startAdminFullTour(userId);
  } else if (role === "desmanche") {
    startDesmancheFullTour(userId);
  } else {
    startTour(userId, role);
  }
}

export function TourHelpButton({ userId, role }: TourHelpButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleTourStart(userId, role)}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      data-tour="help-button"
      data-testid="button-tour-help"
      title="Refazer tour guiado"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Ajuda</span>
    </Button>
  );
}
