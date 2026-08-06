import { ImageResponse } from "next/og";

export const alt = "FireWatch NA — real-time North American wildfire map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "linear-gradient(135deg, #0b1220 0%, #1c1210 100%)",
          padding: "80px",
          color: "#e6edf7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 96 }}>🔥</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, fontWeight: 800 }}>FireWatch NA</div>
            <div style={{ fontSize: 32, color: "#9fb0c9" }}>
              North American Wildfire Map
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 28,
            color: "#9fb0c9",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          Live fires, perimeters, smoke, air quality, evacuation alerts and
          fire-affected highways for Canada, the US and Mexico — from official
          government data.
        </div>
        <div style={{ display: "flex", marginTop: 48, gap: 16 }}>
          {["#dc2626", "#ea580c", "#facc15", "#16a34a", "#9333ea", "#2563eb"].map(
            (c) => (
              <div
                key={c}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: c,
                }}
              />
            )
          )}
        </div>
      </div>
    ),
    size
  );
}
