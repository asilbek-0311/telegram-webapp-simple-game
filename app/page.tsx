"use client";

import { useEffect, useState } from "react";
import { Facehash } from "facehash";

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

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function randomName(): string {
  const length = Math.random() < 0.5 ? 4 : 5;
  let name = "";
  for (let i = 0; i < length; i += 1) {
    name += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return name;
}

export default function Home() {
  const [isAltBg, setIsAltBg] = useState(false);
  const [faceName, setFaceName] = useState(() => randomName());

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
  }, []);

  const handleChange = () => {
    setIsAltBg((value) => !value);
    setFaceName(randomName());
  };

  return (
    <div className={`page ${isAltBg ? "page--alt" : ""}`}>
      <div className="panel">
        <Facehash
          name={faceName}
          size={160}
          showInitial={true}
          enableBlink
          colors={["#ff6f61", "#6c63ff", "#2ec4b6", "#ffb703", "#3a86ff"]}
          className="facehash"
        />
        <button className="button" type="button" onClick={handleChange}>
          Change
        </button>
      </div>
    </div>
  );
}
