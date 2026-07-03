import { useState } from "react";
import { getBrandLogoUrl, getBrandColor, isSimpleIconsUrl } from "@/lib/brandLogos";

interface BrandLogoProps {
  brand: string;
  size?: number;
  className?: string;
}

export function BrandLogo({ brand, size = 48, className = "" }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoUrl = getBrandLogoUrl(brand);
  const color = getBrandColor(brand);
  const initials = brand
    .replace(/^(gm\s*-\s*|vw\s*-\s*)/i, "")
    .slice(0, 2)
    .toUpperCase();

  if (logoUrl && !failed) {
    const isSvg = isSimpleIconsUrl(logoUrl);
    const padding = isSvg ? Math.round(size * 0.18) : Math.round(size * 0.1);
    const inner = size - padding * 2;

    return (
      <div
        className={`flex items-center justify-center bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex-shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size }}
      >
        {isSvg ? (
          <img
            src={logoUrl}
            alt={brand}
            width={inner}
            height={inner}
            style={{
              width: inner,
              height: inner,
              filter:
                "invert(20%) sepia(10%) saturate(500%) hue-rotate(180deg) brightness(0.6)",
              objectFit: "contain",
            }}
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            src={logoUrl}
            alt={brand}
            width={inner}
            height={inner}
            style={{ width: inner, height: inner, objectFit: "contain" }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl text-white font-bold flex-shrink-0 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: color,
        fontSize: Math.round(size * 0.34),
        letterSpacing: "-0.03em",
      }}
    >
      {initials}
    </div>
  );
}
