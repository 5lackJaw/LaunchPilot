import Link from "next/link";
import { AgentStatusHeader, type AgentStatusHeaderState } from "@/components/agent-status-header";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestOutreachDraftAction,
  requestProspectIdentificationAction,
  scheduleOutreachFollowUpAction,
  suppressOutreachContactAction,
} from "@/app/(app)/outreach/actions";
import type { OutreachContact } from "@/server/schemas/outreach";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  OutreachContactReadError,
  OutreachService,
} from "@/server/services/outreach-service";
import {
  ProductReadError,
  ProductService,
} from "@/server/services/product-service";
import { AgentStatusReadError, AgentStatusService } from "@/server/services/agent-status-service";

type PageProps = {
  searchParams: Promise<{
    prospectRequested?: string;
    prospectError?: string;
    draftRequested?: string;
    draftError?: string;
    followUpScheduled?: string;
    followUpError?: string;
    suppressed?: string;
    suppressError?: string;
  }>;
};

export default async function OutreachPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadOutreachData();
  const contacts = data.contacts;

  // KPI values
  const sentCount = contacts.filter((c) =>
    ["sent", "opened", "replied"].includes(c.status),
  ).length;
  const repliedCount = contacts.filter((c) => c.status === "replied").length;
  const replyRate =
    sentCount > 0 ? `${Math.round((repliedCount / sentCount) * 100)}%` : "—";

  // Insight callout
  const repliedContact = contacts.find((c) => c.status === "replied");
  const sentContact = contacts.find((c) =>
    ["sent", "opened"].includes(c.status),
  );

  // Latest sent contact for email preview panel
  const latestSent = contacts
    .filter((c) => ["sent", "opened", "replied"].includes(c.status))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0] ?? null;

  // Follow-up timeline
  const followUps = contacts
    .filter((c) => isFollowUp(c.provenance.followUp))
    .map((c) => ({
      name: c.name,
      scheduledFor: (c.provenance.followUp as { scheduledFor: string })
        .scheduledFor,
    }))
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );


  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <AppTopbar
        title="Outreach"
        eyebrow={
          data.product
            ? `Prospect pipeline · ${data.product.name}`
            : "Prospect pipeline"
        }
        actions={
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted)",
                padding: "3px 8px",
                background: "var(--lp-bg3)",
                border: "1px solid var(--lp-border)",
                borderRadius: "5px",
              }}
            >
              {contacts.length} contacts
            </span>
            {data.product ? (
              <form action={requestProspectIdentificationAction}>
                <button
                  type="submit"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11.5px",
                    fontWeight: 500,
                    padding: "6px 14px",
                    borderRadius: "7px",
                    border: "1px solid var(--lp-purple)",
                    background: "var(--lp-purple-dim)",
                    color: "var(--lp-purple-l)",
                    cursor: "pointer",
                    letterSpacing: "0.01em",
                  }}
                >
                  ⟳ Find prospects
                </button>
              </form>
            ) : null}
            <button
              type="button"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
                padding: "6px 14px",
                borderRadius: "7px",
                border: "1px solid var(--lp-border)",
                background: "transparent",
                color: "var(--lp-muted)",
                cursor: "pointer",
              }}
            >
              Export
            </button>
          </>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "22px 28px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        <AgentStatusHeader
          label="Outreach agent"
          state={data.agentStatus.state}
          lastRun={data.agentStatus.lastRun}
          nextRun={data.agentStatus.nextRun}
          inboxCount={data.agentStatus.inboxCount}
        />

        {/* Alert feedback */}
        {params.prospectRequested ? (
          <Alert>
            <AlertTitle>Prospect identification requested</AlertTitle>
            <AlertDescription>
              LaunchBeacon will rank outreach contacts from the current Marketing
              Brief.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.prospectError || data.error ? (
          <Alert variant="destructive">
            <AlertTitle>Outreach contacts could not be loaded</AlertTitle>
            <AlertDescription>
              {data.error ??
                "Try again after confirming the product and workflow configuration."}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftRequested ? (
          <Alert>
            <AlertTitle>Outreach draft requested</AlertTitle>
            <AlertDescription>
              The email draft will appear here and in the approval inbox after
              the workflow runs.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftError ? (
          <Alert variant="destructive">
            <AlertTitle>Outreach draft request failed</AlertTitle>
            <AlertDescription>
              Only identified, drafted, or failed contacts can request draft
              generation.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.followUpScheduled ? (
          <Alert>
            <AlertTitle>Follow-up scheduled</AlertTitle>
            <AlertDescription>
              The contact now has a durable follow-up reminder in its provenance.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.followUpError ? (
          <Alert variant="destructive">
            <AlertTitle>Follow-up scheduling failed</AlertTitle>
            <AlertDescription>
              Only sent or opened outreach contacts can have follow-ups
              scheduled.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.suppressed ? (
          <Alert>
            <AlertTitle>Contact suppressed</AlertTitle>
            <AlertDescription>
              The contact is blocked from future outreach drafts, sends, and
              follow-ups.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.suppressError ? (
          <Alert variant="destructive">
            <AlertTitle>Suppression failed</AlertTitle>
            <AlertDescription>
              The contact may already be suppressed or no longer available.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
          }}
        >
          {/* Prospects identified */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Prospects identified
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {contacts.length}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              in pipeline
            </div>
          </div>

          {/* Pitches sent */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Pitches sent
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {sentCount}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: sentCount > 0 ? "#2DD4A0" : "var(--lp-muted2)",
              }}
            >
              {sentCount > 0 ? `↑ ${sentCount} delivered` : "none sent yet"}
            </div>
          </div>

          {/* Reply rate */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Reply rate
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {replyRate}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              {repliedCount > 0
                ? `${repliedCount} replied`
                : "awaiting replies"}
            </div>
          </div>

          {/* Est. audience reached */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Est. audience reached
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              —
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              no subscriber data
            </div>
          </div>
        </div>

        {/* Insight callout */}
        <div
          style={{
            background:
              "linear-gradient(180deg, var(--lp-bg3) 0%, var(--lp-bg2) 100%)",
            border: "1px solid var(--lp-border)",
            borderLeft: "3px solid var(--lp-purple)",
            borderRadius: "9px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--lp-purple-dim)",
              border: "1px solid rgba(124,111,247,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "16px", color: "var(--lp-purple-l)" }}>
              ✉
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--lp-purple-l)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              INSIGHT · OUTREACH
            </div>
            {repliedContact ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  Someone replied to your pitch.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    {repliedContact.name}
                  </strong>
                  {repliedContact.publication
                    ? ` from ${repliedContact.publication}`
                    : ""}{" "}
                  has replied. Follow up promptly to close the coverage.
                </div>
              </>
            ) : sentContact ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  A pitch is live — consider a follow-up.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  Your pitch to{" "}
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    {sentContact.name}
                  </strong>
                  {sentContact.publication
                    ? ` (${sentContact.publication})`
                    : ""}{" "}
                  has been{" "}
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    {sentContact.status}
                  </strong>
                  . Schedule a follow-up if no reply within 5 days.
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  Complete the Marketing Brief to identify relevant publications.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  LaunchBeacon matches your product against{" "}
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    newsletters, blogs, and publications
                  </strong>{" "}
                  whose audiences align with your ICP.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main table */}
        <div
          style={{
            background: "var(--lp-bg3)",
            border: "1px solid var(--lp-border)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--lp-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Outreach contacts
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--lp-muted)",
                  padding: "2px 7px",
                  background: "var(--lp-bg4)",
                  borderRadius: "4px",
                  fontWeight: 400,
                }}
              >
                {contacts.length}
              </span>
            </div>
            {contacts.length === 0 && data.product ? (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--lp-amber)",
                  padding: "2px 8px",
                  background: "rgba(240,164,41,0.10)",
                  border: "1px solid rgba(240,164,41,0.20)",
                  borderRadius: "5px",
                }}
              >
                no prospects yet
              </span>
            ) : null}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "960px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Contact",
                    "Publication",
                    "Score",
                    "Status",
                    "Sent",
                    "Follow-up",
                    "Action",
                  ].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "9.5px",
                        fontWeight: 400,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--lp-muted)",
                        textAlign: i === 6 ? "right" : "left",
                        padding: "10px 18px",
                        borderBottom: "1px solid var(--lp-border)",
                        background: "var(--lp-bg2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.length > 0 ? (
                  contacts.map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))
                ) : data.product ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "40px 18px",
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--lp-muted)",
                      }}
                    >
                      No outreach prospects yet. Use Find prospects to research real publication and writer URLs from the current Marketing Brief.
                    </td>
                  </tr>
                ) : null}
                {!data.product ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "40px 18px",
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--lp-muted)",
                      }}
                    >
                      Create a product during onboarding before LaunchBeacon can
                      identify outreach prospects.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom 2-col grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {/* Latest pitch email preview */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--lp-border)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Latest pitch
              {latestSent && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--lp-muted)",
                    padding: "2px 7px",
                    background: "var(--lp-bg4)",
                    borderRadius: "4px",
                    fontWeight: 400,
                  }}
                >
                  {latestSent.status}
                </span>
              )}
            </div>
            <div style={{ padding: "16px 18px" }}>
              {latestSent ? (
                <div
                  style={{
                    background: "var(--lp-bg2)",
                    border: "1px solid var(--lp-border)",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  {/* Email header */}
                  <div
                    style={{
                      borderBottom: "1px solid var(--lp-border)",
                      padding: "12px 16px",
                    }}
                  >
                    {[
                      {
                        label: "To",
                        value: latestSent.email ?? latestSent.url ?? latestSent.name,
                      },
                      {
                        label: "Subject",
                        value: `Covering ${data.product?.name ?? "our product"} — partnership opportunity`,
                      },
                      {
                        label: "From",
                        value: "LaunchBeacon <outreach@launchbeacon.app>",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "var(--lp-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            minWidth: "52px",
                            paddingTop: "1px",
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11.5px",
                            color: "var(--lp-text)",
                            wordBreak: "break-all",
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Email body */}
                  <div style={{ padding: "14px 16px" }}>
                    <p
                      style={{
                        fontSize: "12.5px",
                        color: "var(--lp-muted2)",
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      Hi {latestSent.name},
                      <br />
                      <br />
                      I&apos;m reaching out because{" "}
                      {latestSent.publication
                        ? `${latestSent.publication} readers`
                        : "your audience"}{" "}
                      would genuinely benefit from{" "}
                      <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                        {data.product?.name ?? "our product"}
                      </strong>
                      . We&apos;re helping founders with AI-powered go-to-market
                      automation, and I&apos;d love to explore a feature or
                      coverage opportunity.
                      <br />
                      <br />
                      Would you be open to a quick intro?
                    </p>
                    <div
                      style={{
                        marginTop: "14px",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--lp-border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "var(--lp-muted)",
                      }}
                    >
                      Sent{" "}
                      {new Date(latestSent.updatedAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}{" "}
                      · status:{" "}
                      <span style={{ color: contactStatusColor(latestSent.status) }}>
                        {latestSent.status}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--lp-bg2)",
                    border: "1px solid var(--lp-border)",
                    borderRadius: "8px",
                    padding: "24px 18px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--lp-muted)",
                      lineHeight: 1.7,
                    }}
                  >
                    No sent pitches yet. Draft and approve an outreach item from a real prospect to see the latest pitch here.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up schedule */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--lp-border)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Follow-up schedule
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--lp-muted)",
                  padding: "2px 7px",
                  background: "var(--lp-bg4)",
                  borderRadius: "4px",
                  fontWeight: 400,
                }}
              >
                {followUps.length} upcoming
              </span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  position: "relative",
                }}
              >
                {followUps.map((fu, i, arr) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "14px",
                        position: "relative",
                        paddingBottom: i < arr.length - 1 ? "20px" : "0",
                      }}
                    >
                      {/* Timeline line */}
                      {i < arr.length - 1 && (
                        <div
                          style={{
                            position: "absolute",
                            left: "5px",
                            top: "14px",
                            width: "1px",
                            height: "calc(100% - 4px)",
                            background: "var(--lp-border2)",
                          }}
                        />
                      )}
                      {/* Dot */}
                      <div
                        style={{
                          width: "11px",
                          height: "11px",
                          borderRadius: "50%",
                          background: "var(--lp-purple)",
                          border: "2px solid var(--lp-bg3)",
                          boxShadow: `0 0 0 1px var(--lp-purple)`,
                          flexShrink: 0,
                          marginTop: "2px",
                          position: "relative",
                          zIndex: 1,
                        }}
                      />
                      {/* Content */}
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "var(--lp-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "2px",
                          }}
                        >
                          {new Date(fu.scheduledFor).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--lp-text)",
                            fontWeight: 500,
                          }}
                        >
                          Follow up to{" "}
                          <span style={{ color: "var(--lp-purple-l)" }}>
                            {fu.name}
                          </span>
                        </div>
                      </div>
                    </div>
                ))}
                {followUps.length === 0 && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--lp-muted)",
                      textAlign: "center",
                      padding: "20px 0",
                    }}
                  >
                    {contacts.length > 0
                      ? "No follow-ups scheduled. Use the Follow up button on sent contacts."
                      : "No follow-ups yet. Sent or opened pitches can be scheduled here."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function contactStatusColor(status: string): string {
  if (status === "replied" || status === "converted") return "#2DD4A0";
  if (status === "opened") return "#5B9EF6";
  if (status === "sent") return "var(--lp-amber)";
  if (status === "drafted" || status === "pending_review") return "var(--lp-purple-l)";
  if (status === "suppressed" || status === "failed") return "var(--lp-red)";
  return "var(--lp-muted2)";
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "#2DD4A0";
  if (pct >= 60) return "var(--lp-amber)";
  return "var(--lp-red)";
}

function ContactStatusPill({ status }: { status: string }) {
  const color = contactStatusColor(status);
  let bg = "var(--lp-bg4)";
  let border = "var(--lp-border)";

  if (status === "replied" || status === "converted") {
    bg = "rgba(45,212,160,0.10)";
    border = "rgba(45,212,160,0.25)";
  } else if (status === "opened") {
    bg = "rgba(91,158,246,0.10)";
    border = "rgba(91,158,246,0.25)";
  } else if (status === "sent") {
    bg = "rgba(240,164,41,0.10)";
    border = "rgba(240,164,41,0.25)";
  } else if (status === "drafted" || status === "pending_review") {
    bg = "var(--lp-purple-dim)";
    border = "rgba(124,111,247,0.25)";
  } else if (status === "suppressed" || status === "failed") {
    bg = "var(--lp-red-dim)";
    border = "rgba(240,96,96,0.25)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-mono)",
        fontSize: "10.5px",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontWeight: 500,
        border: `1px solid ${border}`,
        color,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: color,
          display: "block",
          flexShrink: 0,
        }}
      />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ContactRow({ contact }: { contact: OutreachContact }) {
  const scorePct = Math.round(contact.score * 100);
  const fuLabel = followUpLabel(contact);

  return (
    <tr style={{ borderBottom: "1px solid var(--lp-border)" }}>
      <td style={{ padding: "12px 18px", verticalAlign: "middle", maxWidth: "220px" }}>
        <div
          style={{
            fontSize: "13px",
            color: "var(--lp-text)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {contact.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--lp-muted)",
            marginTop: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {contact.email ?? "Contact needed"}
        </div>
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontSize: "13px",
          color: "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {contact.publication ?? "—"}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: scoreColor(scorePct),
          fontWeight: 600,
        }}
      >
        {scorePct}
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        <ContactStatusPill status={contact.status} />
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {contact.lastContactAt
          ? new Date(contact.lastContactAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "—"}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: fuLabel ? "var(--lp-purple-l)" : "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {fuLabel ?? "—"}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          textAlign: "right",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "6px",
          }}
        >
          {["identified", "drafted", "failed"].includes(contact.status) && (
            <form action={requestOutreachDraftAction}>
              <input type="hidden" name="contactId" value={contact.id} />
              <button
                type="submit"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--lp-border2)",
                  background: "var(--lp-bg4)",
                  color: "var(--lp-text)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {contact.email ? "Draft" : "Draft pitch"}
              </button>
            </form>
          )}
          {["sent", "opened"].includes(contact.status) && (
            <form action={scheduleOutreachFollowUpAction}>
              <input type="hidden" name="contactId" value={contact.id} />
              <input type="hidden" name="delayDays" value="5" />
              <button
                type="submit"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--lp-border2)",
                  background: "var(--lp-bg4)",
                  color: "var(--lp-text)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Follow up
              </button>
            </form>
          )}
          {!["suppressed", "converted"].includes(contact.status) && (
            <form action={suppressOutreachContactAction}>
              <input type="hidden" name="contactId" value={contact.id} />
              <input
                type="hidden"
                name="reason"
                value="Suppressed from outreach tracker."
              />
              <button
                type="submit"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--lp-border)",
                  background: "transparent",
                  color: "var(--lp-muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Suppress
              </button>
            </form>
          )}
          {contact.url && !contact.url.includes("example.com") && (
            <Link
              href={contact.url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid var(--lp-border)",
                background: "transparent",
                color: "var(--lp-muted)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Open ↗
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}


async function loadOutreachData(): Promise<{
  product: Product | null;
  contacts: OutreachContact[];
  agentStatus: {
    state: AgentStatusHeaderState;
    lastRun: string;
    nextRun: string;
    inboxCount: number;
  };
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, contacts: [], agentStatus: emptyAgentStatus("not_configured"), error: null };
    }

    const contacts = await new OutreachService(supabase).listContacts({
      productId: product.id,
    });
    const agentStatus = await new AgentStatusService(supabase).getHeader({
      productId: product.id,
      channel: "outreach",
      itemUpdatedAts: contacts.map((contact) => contact.updatedAt),
    });
    return { product, contacts, agentStatus, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, contacts: [], agentStatus: emptyAgentStatus("not_configured"), error: error.message };
    }

    if (
      error instanceof ProductReadError ||
      error instanceof OutreachContactReadError ||
      error instanceof AgentStatusReadError
    ) {
      return { product: null, contacts: [], agentStatus: emptyAgentStatus("not_configured"), error: error.message };
    }

    if (
      error instanceof Error &&
      error.message.includes("Supabase URL and publishable key")
    ) {
      return {
        product: null,
        contacts: [],
        agentStatus: emptyAgentStatus("not_configured"),
        error:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function emptyAgentStatus(state: AgentStatusHeaderState) {
  return {
    state,
    lastRun: "No runs yet",
    nextRun: "Not scheduled",
    inboxCount: 0,
  };
}

function countContacts(contacts: OutreachContact[]) {
  return {
    identified: String(
      contacts.filter((contact) => contact.status === "identified").length,
    ),
    drafted: String(
      contacts.filter(
        (contact) =>
          contact.status === "drafted" || contact.status === "pending_review",
      ).length,
    ),
    sent: String(
      contacts.filter(
        (contact) =>
          contact.status === "sent" ||
          contact.status === "opened" ||
          contact.status === "replied",
      ).length,
    ),
    closed: String(
      contacts.filter(
        (contact) =>
          contact.status === "suppressed" || contact.status === "failed",
      ).length,
    ),
  };
}

// Keep countContacts in scope for potential future use
void countContacts;

function followUpLabel(contact: OutreachContact): string | null {
  const followUp = contact.provenance.followUp;
  if (!isFollowUp(followUp)) {
    return null;
  }

  return `Follow-up ${new Date(followUp.scheduledFor).toLocaleDateString()}`;
}

function isFollowUp(value: unknown): value is { scheduledFor: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "scheduledFor" in value &&
    typeof value.scheduledFor === "string"
  );
}
