import { useState } from "react";

type AdBannerProps = {
  imageUrl: string;
  linkUrl: string;
  altText?: string;
};

export function AdBanner({ imageUrl, linkUrl, altText }: AdBannerProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) return null;

  return (
    <div className="w-full flex justify-center py-2 bg-muted/30">
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-ocid="ad_banner.link"
        className="block overflow-hidden"
        style={{ maxWidth: "960px", width: "100%" }}
      >
        <img
          src={imageUrl}
          alt={altText ?? "Advertisement"}
          onError={() => setImgError(true)}
          style={{
            width: "960px",
            maxWidth: "100%",
            height: "200px",
            objectFit: "cover",
            display: "block",
          }}
        />
      </a>
    </div>
  );
}
