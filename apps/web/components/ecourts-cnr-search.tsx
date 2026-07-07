"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchEcourts } from "@/app/(app)/matters/new/actions";
import type { SearchResult, SearchType } from "@/lib/ecourts/types";

interface Props {
  /** Called when the user selects a search result — passes the CNR to the parent form. */
  onSelect: (cnr: string, title: string) => void;
}

const SEARCH_TYPES: { value: SearchType; label: string }[] = [
  { value: "party_name", label: "Party name" },
  { value: "fir_number", label: "FIR number" },
  { value: "filing_number", label: "Filing number" },
];

export function EcourtsCnrSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("party_name");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    if (!query.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await searchEcourts(query, searchType);
      if (res.ok) {
        setResults(res.results);
        if (res.results.length === 0) setError("No cases found — try a different query.");
      } else {
        setResults(null);
        setError(
          res.reason === "rate_limited"
            ? "eCourts rate limit reached — try again in a moment."
            : res.reason === "unauthorized"
              ? "eCourts API key not configured."
              : "Search failed — check your connection and try again.",
        );
      }
    });
  }

  function handleSelect(result: SearchResult) {
    onSelect(result.cnr, result.title);
    setResults(null);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as SearchType)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {SEARCH_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder={
            searchType === "party_name"
              ? "e.g. State of MP"
              : searchType === "fir_number"
                ? "e.g. 123/2024"
                : "e.g. W.P.(C)/45/2024"
          }
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={isPending || !query.trim()}
        >
          <Search className="size-4" />
          {isPending ? "Searching…" : "Search"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {results && results.length > 0 && (
        <ul className="rounded-md border border-border divide-y divide-border text-sm max-h-48 overflow-y-auto">
          {results.map((r) => (
            <li key={r.cnr}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                onClick={() => handleSelect(r)}
              >
                <span className="block font-medium truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground font-mono">{r.cnr}</span>
                {r.court && (
                  <span className="text-xs text-muted-foreground ml-2">· {r.court}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
