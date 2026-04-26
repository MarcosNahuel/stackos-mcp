import { describe, it, expect } from "vitest";
import {
  exactIdempotency,
  paragraphRecords,
  normalizeParagraph,
  splitParagraphs,
} from "./merge-paragraphs.js";

describe("normalizeParagraph", () => {
  it("trim + colapsa whitespace", () => {
    expect(normalizeParagraph("  Hola   mundo\n  con   varios espacios ")).toBe(
      "Hola mundo con varios espacios"
    );
  });

  it("preserva case", () => {
    expect(normalizeParagraph("Foo BAR baz")).toBe("Foo BAR baz");
  });
});

describe("splitParagraphs", () => {
  it("separa por doble newline", () => {
    expect(splitParagraphs("a\n\nb\n\nc")).toEqual(["a", "b", "c"]);
  });

  it("ignora párrafos vacíos", () => {
    expect(splitParagraphs("\n\n\n\nhola\n\n\n\nadios\n\n")).toEqual([
      "hola",
      "adios",
    ]);
  });
});

describe("paragraphRecords", () => {
  it("hashes son determinísticos y match si normalizan al mismo string", () => {
    const a = paragraphRecords("Hola   mundo\n\nFoo bar");
    const b = paragraphRecords("Hola mundo\n\nFoo  bar");
    expect(a[0].hash).toBe(b[0].hash);
    expect(a[1].hash).toBe(b[1].hash);
  });
});

describe("exactIdempotency", () => {
  it("draft sin overlap con target → todo va a toAppend", () => {
    const r = exactIdempotency("alpha\n\nbeta", "gamma\n\ndelta");
    expect(r.toAppend).toHaveLength(2);
    expect(r.alreadyPresent).toHaveLength(0);
  });

  it("draft 100% subset del target → 0 toAppend", () => {
    const r = exactIdempotency("alpha\n\nbeta", "alpha\n\nbeta\n\ngamma");
    expect(r.toAppend).toHaveLength(0);
    expect(r.alreadyPresent).toHaveLength(2);
  });

  it("draft parcial overlap → solo nuevos en toAppend", () => {
    const r = exactIdempotency(
      "alpha\n\nbeta\n\ngamma",
      "alpha\n\ndelta"
    );
    expect(r.toAppend.map((p) => p.text)).toEqual(["beta", "gamma"]);
    expect(r.alreadyPresent.map((p) => p.text)).toEqual(["alpha"]);
  });

  it("whitespace differences son idempotentes", () => {
    const r = exactIdempotency(
      "Hola  mundo  con   espacios",
      "Hola mundo con espacios"
    );
    expect(r.toAppend).toHaveLength(0);
    expect(r.alreadyPresent).toHaveLength(1);
  });
});
