import { MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationMessageProps {
  content: string;
  isMe: boolean;
}

export function LocationMessage({ content, isMe }: LocationMessageProps) {
  let lat: number, lng: number, name: string | undefined;
  try {
    const parsed = JSON.parse(content);
    lat = parsed.lat;
    lng = parsed.lng;
    name = parsed.name;
  } catch {
    return <span className="text-muted-foreground italic text-sm">Vị trí không hợp lệ</span>;
  }

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="min-w-[220px] max-w-[280px] space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate">{name || "Vị trí đã chia sẻ"}</span>
      </div>

      <div className="rounded-lg overflow-hidden border border-border">
        <iframe
          src={mapUrl}
          width="100%"
          height="150"
          style={{ border: 0 }}
          loading="lazy"
          title="Location map"
          className="pointer-events-none"
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs gap-1.5 text-primary"
        onClick={() => window.open(googleMapsUrl, "_blank")}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Mở trong Google Maps
      </Button>
    </div>
  );
}
