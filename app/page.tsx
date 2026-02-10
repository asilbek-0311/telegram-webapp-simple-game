"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export default function Home() {
  const [isAltBg, setIsAltBg] = useState(false);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
  }, []);

  return (
    <div className={`page ${isAltBg ? "page--alt" : ""}`}>
      <main className="card">
        <div className="avatar">
          <Image
            src="/avatar.png"
            alt="Avatar"
            width={160}
            height={160}
            priority
          />
        </div>
        <h1>Telegram Learning WebApp</h1>
        <p className="subtitle">
          A tiny landing page to learn the basics of Telegram Web Apps and
          Next.js.
        </p>
        <p className="info">
          Click the button to change the background. This shows how React state
          can update the UI instantly.
        </p>
        <button
          className="button"
          type="button"
          onClick={() => setIsAltBg((value) => !value)}
        >
          Change Background
        </button>
      </main>
    </div>
  );
}
