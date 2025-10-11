"use client";

import { useState } from "react";
import {
  cmToIn,
  inToCm,
  kgToLb,
  lbToKg,
  lToGal,
  galToL,
  round,
} from "../lib/units";

type Mode = "length" | "weight" | "volume";

export default function ConversionTool() {
  const [mode, setMode] = useState<Mode>("length");
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const parse = (v: string) => (v.trim() === "" ? NaN : Number(v));

  const compute = () => {
    const va = parse(a);
    const vb = parse(b);

    if (mode === "length") {
      if (!isNaN(va) && b === "") return setB(String(round(cmToIn(va))));
      if (!isNaN(vb) && a === "") return setA(String(round(inToCm(vb))));
    }
    if (mode === "weight") {
      if (!isNaN(va) && b === "") return setB(String(round(kgToLb(va))));
      if (!isNaN(vb) && a === "") return setA(String(round(lbToKg(vb))));
    }
    if (mode === "volume") {
      if (!isNaN(va) && b === "") return setB(String(round(lToGal(va))));
      if (!isNaN(vb) && a === "") return setA(String(round(galToL(vb))));
    }
  };

  return (
    <section
      style={{
        maxWidth: "500px",
        margin: "0 auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "12px",
      }}
    >
      <h2>Conversion Tool</h2>

      <div style={{ marginBottom: "10px" }}>
        <button
          onClick={() => {
            setMode("length");
            setA("");
            setB("");
          }}
        >
          Length (cm ↔ in)
        </button>
        <button
          onClick={() => {
            setMode("weight");
            setA("");
            setB("");
          }}
        >
          Weight (kg ↔ lb)
        </button>
        <button
          onClick={() => {
            setMode("volume");
            setA("");
            setB("");
          }}
        >
          Volume (L ↔ gal)
        </button>
      </div>

      <input
        placeholder={
          mode === "length"
            ? "Centimeters"
            : mode === "weight"
            ? "Kilograms"
            : "Liters"
        }
        value={a}
        onChange={(e) => setA(e.target.value)}
        onBlur={compute}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <input
        placeholder={
          mode === "length"
            ? "Inches"
            : mode === "weight"
            ? "Pounds"
            : "Gallons"
        }
        value={b}
        onChange={(e) => setB(e.target.value)}
        onBlur={compute}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <div>
        <button
          onClick={() => {
            setA("");
            setB("");
          }}
        >
          Clear
        </button>
        <button onClick={compute}>Convert</button>
      </div>
    </section>
  );
}
