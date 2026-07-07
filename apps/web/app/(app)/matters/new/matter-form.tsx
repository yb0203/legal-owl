"use client";

import { useState } from "react";
import { createMatter } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { EcourtsCnrSearch } from "@/components/ecourts-cnr-search";
import { FORUM_TYPES, FORUM_LABELS } from "@/lib/types";

interface Props {
  clients: { id: string; display_name: string }[];
  defaultClientId?: string;
  error?: string;
}

export function MatterForm({ clients, defaultClientId, error }: Props) {
  const [cnr, setCnr] = useState("");
  const [title, setTitle] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  function handleSearchSelect(selectedCnr: string, selectedTitle: string) {
    setCnr(selectedCnr);
    if (!title) setTitle(selectedTitle);
    setShowSearch(false);
  }

  return (
    <form action={createMatter} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. MBECL vs SCCL"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client_id">Client</Label>
        <NativeSelect id="client_id" name="client_id" defaultValue={defaultClientId ?? ""}>
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="forum_type">Forum</Label>
          <NativeSelect id="forum_type" name="forum_type" defaultValue="district">
            {FORUM_TYPES.map((f) => (
              <option key={f} value={f}>
                {FORUM_LABELS[f]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="case_type">Case type</Label>
          <Input id="case_type" name="case_type" placeholder="e.g. W.P.(C)" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="petitioners">Petitioners</Label>
          <Textarea id="petitioners" name="petitioners" rows={2} placeholder="One per line" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="respondents">Respondents</Label>
          <Textarea id="respondents" name="respondents" rows={2} placeholder="One per line" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="cnr">
            CNR <span className="text-muted-foreground">(optional)</span>
          </Label>
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => setShowSearch((s) => !s)}
          >
            {showSearch ? "Enter CNR manually" : "Find on eCourts"}
          </button>
        </div>

        {showSearch ? (
          <EcourtsCnrSearch onSelect={handleSearchSelect} />
        ) : (
          <Input
            id="cnr"
            name="cnr"
            placeholder="e.g. DLHC010001232024"
            className="font-mono"
            value={cnr}
            onChange={(e) => setCnr(e.target.value)}
          />
        )}
        {/* Hidden input so the CNR from search is also submitted with the form */}
        {showSearch && <input type="hidden" name="cnr" value={cnr} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="first_hearing_date">First hearing</Label>
        <Input id="first_hearing_date" name="first_hearing_date" type="date" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full">
        Create matter
      </Button>
    </form>
  );
}
