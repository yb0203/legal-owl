import * as React from "react";

// Renders an attribute value and, for enum-typed attributes, exposes the full
// allowed domain on hover — so the user can see "what values this can take."
// Keeps the rail uncluttered while the domain stays one hover away (the full
// enumeration also lives in the Help glossary).
export function AttributeValue({
  value,
  domain,
}: {
  value: React.ReactNode;
  domain?: readonly string[];
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <span title={domain ? `One of: ${domain.join(", ")}` : undefined}>
      {empty ? <span className="text-muted-foreground">—</span> : value}
    </span>
  );
}
