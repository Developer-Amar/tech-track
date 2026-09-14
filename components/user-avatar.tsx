"use client";

import { useState, useEffect, useCallback } from "react";
import { User } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

/**
 * UserAvatar — Resilient avatar component.
 * Attempts direct image load first. If client-side CORS/referrer issues occur,
 * automatically fails over to the server-side /api/avatar proxy.
 * If that also fails, falls back gracefully to a styled User icon.
 */
export default function UserAvatar({
  src,
  alt,
  className = "w-full h-full object-cover relative z-10",
  iconClassName = "w-8 h-8 text-[#00E5FF] relative z-10",
}: UserAvatarProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasTriedProxy, setHasTriedProxy] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasTriedProxy(false);
    setIsError(false);
  }, [src]);

  const handleError = useCallback(() => {
    if (
      !hasTriedProxy &&
      src &&
      !src.startsWith("/api/avatar") &&
      (src.includes("googleusercontent.com") || src.includes("google.com"))
    ) {
      setHasTriedProxy(true);
      setImgSrc(`/api/avatar?url=${encodeURIComponent(src)}`);
    } else {
      setIsError(true);
    }
  }, [src, hasTriedProxy]);

  if (!imgSrc || isError) {
    return (
      <>
        <div className="absolute inset-0 bg-[#00E5FF]/10 group-hover:bg-[#00E5FF]/20 transition-colors duration-300" />
        <User className={iconClassName} />
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
    />
  );
}
