"use client";
import { useState } from "react";

export function Portrait({ src, name, className = "" }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState("");
  return <span className={`person-portrait ${className}`} aria-hidden="true">
    {src && failed !== src ? <img src={src} alt="" onError={() => setFailed(src)} /> : <span>{Array.from(name.trim())[0] || "侠"}</span>}
  </span>;
}
