"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Facehash } from "facehash";
import type { FriendGraphResponse, UserPublic } from "@/lib/types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

type PendingIncomingRequest = {
  id: string;
  from: UserPublic;
};

type GraphApiResponse = FriendGraphResponse & {
  pendingIncomingRequests: PendingIncomingRequest[];
};

type PositionedNode = {
  user: UserPublic;
  x: number;
  y: number;
  size: number;
};

function toLabel(user: UserPublic): string {
  if (user.username) {
    return `@${user.username}`;
  }
  if (user.displayName) {
    return user.displayName;
  }
  return `id:${user.telegramId}`;
}

function placeNodes(users: UserPublic[], radius: number, size: number): PositionedNode[] {
  if (!users.length) {
    return [];
  }

  const center = 210;
  const step = (Math.PI * 2) / users.length;

  return users
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((user, index) => {
      const angle = -Math.PI / 2 + step * index;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return { user, x, y, size };
    });
}

export default function Home() {
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "error">(
    "loading"
  );
  const [statusMessage, setStatusMessage] = useState("Authenticating...");
  const [graph, setGraph] = useState<GraphApiResponse | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const loadGraph = useCallback(async () => {
    const response = await fetch("/api/friends/graph", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load friend graph");
    }

    const payload = (await response.json()) as GraphApiResponse;
    setGraph(payload);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();

        const initData = window.Telegram?.WebApp?.initData?.trim();
        if (!initData) {
          setStatus("blocked");
          setStatusMessage("Open this app inside Telegram to authenticate.");
          return;
        }

        const authResponse = await fetch("/api/auth/telegram", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ initData }),
        });

        if (!authResponse.ok) {
          const body = (await authResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Telegram authentication failed");
        }

        await loadGraph();
        setStatus("ready");
        setStatusMessage("");
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Unexpected authentication error"
        );
      }
    };

    void run();
  }, [loadGraph]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const payload = (await response.json()) as { users: UserPublic[] };
      setSearchResults(payload.users);
    } catch {
      setToast("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleSendRequest = useCallback(
    async (targetUsername: string) => {
      setBusyKey(`send:${targetUsername}`);
      try {
        const response = await fetch("/api/friends/request", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ targetUsername }),
        });

        const payload = (await response.json()) as
          | { status?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to send request");
        }

        if (payload?.status === "accepted") {
          setToast("Connected instantly (reciprocal request).");
        } else if (payload?.status === "already_connected") {
          setToast("You are already connected.");
        } else {
          setToast("Friend request sent.");
        }

        await loadGraph();
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Unable to send request");
      } finally {
        setBusyKey(null);
      }
    },
    [loadGraph]
  );

  const handleAccept = useCallback(
    async (requestId: string) => {
      setBusyKey(`accept:${requestId}`);
      try {
        const response = await fetch("/api/friends/accept", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requestId }),
        });

        const payload = (await response.json()) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to accept request");
        }

        setToast("Connection accepted.");
        await loadGraph();
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Unable to accept request");
      } finally {
        setBusyKey(null);
      }
    },
    [loadGraph]
  );

  const directNodes = useMemo(
    () => placeNodes(graph?.directFriends ?? [], 125, 64),
    [graph?.directFriends]
  );

  const secondNodes = useMemo(
    () => placeNodes(graph?.secondDegree ?? [], 185, 48),
    [graph?.secondDegree]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    map.set(graph?.me.id ?? "", { x: 210, y: 210 });
    for (const node of directNodes) {
      map.set(node.user.id, { x: node.x, y: node.y });
    }
    for (const node of secondNodes) {
      map.set(node.user.id, { x: node.x, y: node.y });
    }
    return map;
  }, [graph?.me.id, directNodes, secondNodes]);

  if (status !== "ready" || !graph) {
    return (
      <div className="screen">
        <div className="stateCard">{statusMessage}</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topBar">
        <button
          className="connectionsBtn"
          type="button"
          onClick={() => setIsPanelOpen(true)}
        >
          Connections
        </button>
      </header>

      <main className="main">
        <Facehash
          name={graph.me.facehashSeed}
          size={170}
          showInitial={false}
          enableBlink
          colors={["#ff6f61", "#6c63ff", "#2ec4b6", "#ffb703", "#3a86ff"]}
          className="faceMain"
        />

        <div className="stats">
          <span>Connected: {graph.stats.connected}</span>
          <span>Pending: {graph.stats.pendingIncoming}</span>
        </div>

        <section className="graphBoard" aria-label="Friend graph">
          <svg className="graphLines" viewBox="0 0 420 420" aria-hidden="true">
            {graph.edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) {
                return null;
              }
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(35,45,65,0.38)"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          <div className="graphNode graphNodeCenter" style={{ left: 210, top: 210 }}>
            <Facehash
              name={graph.me.facehashSeed}
              size={74}
              showInitial={false}
              enableBlink
              colors={["#ff6f61", "#6c63ff", "#2ec4b6", "#ffb703", "#3a86ff"]}
            />
          </div>

          {directNodes.map((node) => (
            <button
              type="button"
              className="graphNode graphNodeButton"
              key={node.user.id}
              style={{ left: node.x, top: node.y }}
              title={toLabel(node.user)}
            >
              <Facehash
                name={node.user.facehashSeed}
                size={node.size}
                showInitial={false}
                enableBlink
                colors={["#ff6f61", "#6c63ff", "#2ec4b6", "#ffb703", "#3a86ff"]}
              />
            </button>
          ))}

          {secondNodes.map((node) => (
            <button
              type="button"
              className="graphNode graphNodeButton"
              key={node.user.id}
              style={{ left: node.x, top: node.y }}
              title={toLabel(node.user)}
            >
              <Facehash
                name={node.user.facehashSeed}
                size={node.size}
                showInitial={false}
                enableBlink
                colors={["#ff6f61", "#6c63ff", "#2ec4b6", "#ffb703", "#3a86ff"]}
              />
            </button>
          ))}
        </section>
      </main>

      <aside className={`drawer ${isPanelOpen ? "drawerOpen" : ""}`}>
        <div className="drawerHeader">
          <h2>Connections</h2>
          <button type="button" className="ghost" onClick={() => setIsPanelOpen(false)}>
            Close
          </button>
        </div>

        <section className="drawerSection">
          <label htmlFor="search">Search by username</label>
          <div className="row">
            <input
              id="search"
              type="text"
              placeholder="@username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" className="primary" onClick={handleSearch}>
              {isSearching ? "..." : "Find"}
            </button>
          </div>

          <div className="list">
            {searchResults.map((user) => (
              <div className="listItem" key={user.id}>
                <span>{user.username ? `@${user.username}` : "No username"}</span>
                <button
                  type="button"
                  className="primary"
                  onClick={() => user.username && handleSendRequest(user.username)}
                  disabled={!user.username || busyKey === `send:${user.username}`}
                >
                  Connect
                </button>
              </div>
            ))}
            {!searchResults.length ? <p className="hint">No search results yet.</p> : null}
          </div>
        </section>

        <section className="drawerSection">
          <h3>Incoming Requests</h3>
          <div className="list">
            {graph.pendingIncomingRequests.map((item) => (
              <div className="listItem" key={item.id}>
                <span>{toLabel(item.from)}</span>
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleAccept(item.id)}
                  disabled={busyKey === `accept:${item.id}`}
                >
                  Accept
                </button>
              </div>
            ))}
            {!graph.pendingIncomingRequests.length ? (
              <p className="hint">No incoming requests.</p>
            ) : null}
          </div>
        </section>

        <section className="drawerSection">
          <h3>Outgoing Pending</h3>
          <div className="list">
            {graph.pendingOutgoing.map((user) => (
              <div className="listItem" key={user.id}>
                <span>{toLabel(user)}</span>
                <span className="muted">Pending</span>
              </div>
            ))}
            {!graph.pendingOutgoing.length ? <p className="hint">No outgoing pending.</p> : null}
          </div>
        </section>
      </aside>

      {isPanelOpen ? (
        <button
          type="button"
          aria-label="Close panel backdrop"
          className="backdrop"
          onClick={() => setIsPanelOpen(false)}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
