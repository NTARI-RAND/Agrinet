"use client";

import ConversionTool from "../../../components/ConversionTool";

export default function ConversionPage() {
  return (
    <main style={{ padding: "20px" }}>
      <h1>Unit Conversion</h1>
      <p style={{ marginBottom: "20px" }}>
        Convert between metric and imperial units for length, weight, and
        volume.
      </p>
      <ConversionTool />
    </main>
  );
}
