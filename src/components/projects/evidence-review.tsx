"use client";

import type { EvidencePack } from "@/research/contracts";

export function EvidenceReview({ evidence }: { evidence: EvidencePack }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        Evidence revision {evidence.revision}. Citations show provenance, not
        guaranteed truth.
      </p>
      {evidence.attribution.searchSuggestionHtml && (
        <iframe
          title="Google Search suggestions"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className="w-full border-0"
          srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${evidence.attribution.searchSuggestionHtml}`}
        />
      )}
      <ul>
        {evidence.sources.map((item) => (
          <li key={item.id}>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}{" "}
            — {item.provenance.replaceAll("_", " ")}; retrieved{" "}
            {item.retrievedAt.slice(0, 10)}
            {item.publishedAt
              ? `; published ${item.publishedAt.slice(0, 10)}`
              : ""}
            <details>
              <summary>Source excerpts</summary>
              {item.excerpts.map((excerpt) => (
                <p key={excerpt.id} className="break-words whitespace-pre-wrap">
                  {excerpt.text}
                </p>
              ))}
            </details>
          </li>
        ))}
      </ul>
      {evidence.claims.map((claim) => (
        <p key={claim.id}>
          {claim.text}{" "}
          <span className="text-muted-foreground">
            (
            {claim.references
              .map(
                (reference) =>
                  evidence.sources.find(
                    (source) => source.id === reference.sourceId,
                  )?.title ?? reference.sourceId,
              )
              .filter((value, index, all) => all.indexOf(value) === index)
              .join(", ")}
            )
          </span>
        </p>
      ))}
      {evidence.conflicts.map((conflict) => (
        <p key={conflict.id}>Conflict: {conflict.description}</p>
      ))}
      {evidence.gaps.map((gap) => (
        <p key={gap}>Gap: {gap}</p>
      ))}
    </div>
  );
}
