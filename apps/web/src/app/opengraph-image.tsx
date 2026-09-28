import { ImageResponse } from "next/og";

export const alt = "Project Control Center — Mission Control for your projects";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamically rendered (next/og / satori) instead of a static PNG — this repo has no image
 * assets checked in, and this keeps the OG card themed to the actual "Mission Control" palette
 * (see globals.css) without hand-exporting a design file every time the theme changes.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0a0d16 0%, #12152a 55%, #1a1330 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "999px",
              background: "#22d3ee",
              boxShadow: "0 0 24px 6px rgba(34,211,238,0.55)",
            }}
          />
          <div
            style={{
              fontSize: "22px",
              letterSpacing: "6px",
              color: "#7fe3f4",
              fontFamily: "monospace",
            }}
          >
            MISSION CONTROL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "82px",
              fontWeight: 700,
              color: "#f5f6fb",
              lineHeight: 1.05,
            }}
          >
            Project Control Center
          </div>
          <div style={{ fontSize: "30px", color: "#a9aec8", maxWidth: "920px" }}>
            Render uptime, Vercel deploy status, and a roster of Claude Code agents — one command
            deck for every project you run.
          </div>
        </div>

        <div style={{ display: "flex", gap: "28px" }}>
          {[
            { label: "BACKEND", state: "UP", color: "#34d399" },
            { label: "FRONTEND", state: "LIVE", color: "#22d3ee" },
            { label: "AGENTS", state: "STANDBY", color: "#fbbf24" },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 20px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                fontFamily: "monospace",
                fontSize: "20px",
                color: "#cfd3e6",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: chip.color,
                }}
              />
              {chip.label}
              <span style={{ color: chip.color }}>{chip.state}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
