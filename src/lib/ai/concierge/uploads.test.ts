import { describe, expect, it } from "vitest";
import { cleanUploads, MAX_UPLOAD_CHARS, UploadProblem, userContent } from "./uploads";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

describe("chat uploads", () => {
  it("accepts photos, PDFs and text files, and nothing else", () => {
    const ok = cleanUploads([
      { name: "ticket.jpg", type: "image/jpeg", data: png },
      { name: "booking.pdf", type: "application/pdf", data: png },
      { name: "notes.txt", type: "text/plain", data: Buffer.from("Hotel at 8").toString("base64") },
    ]);
    expect(ok.map((u) => u.kind)).toEqual(["image", "pdf", "text"]);
    expect(() => cleanUploads([{ name: "run.exe", type: "application/x-msdownload", data: png }])).toThrow(UploadProblem);
    expect(cleanUploads(undefined)).toEqual([]);
  });

  it("rejects broken data, too many files and too much at once", () => {
    expect(() => cleanUploads([{ name: "a.png", type: "image/png", data: "not base64!" }])).toThrow(/couldn't be read/);
    expect(() => cleanUploads(Array.from({ length: 5 }, () => ({ name: "a.png", type: "image/png", data: png })))).toThrow(/up to 4/);
    const big = "A".repeat(MAX_UPLOAD_CHARS / 2 + 4);
    expect(() => cleanUploads([{ name: "a.png", type: "image/png", data: big }, { name: "b.png", type: "image/png", data: big }])).toThrow(/too large/);
  });

  it("sends the files to the AI as input parts after the user's words", () => {
    const parts = userContent("What time is my flight?", cleanUploads([
      { name: "a.png", type: "image/png", data: png },
      { name: "b.pdf", type: "application/pdf", data: png },
      { name: "c.txt", type: "text/plain", data: Buffer.from("Gate 12").toString("base64") },
    ])) as { type: string; text?: string; image_url?: string; file_data?: string; filename?: string }[];
    expect(parts[0].type).toBe("input_text");
    expect(parts[0].text).toMatch(/^What time is my flight\?/);
    expect(parts[1]).toMatchObject({ type: "input_image", image_url: `data:image/png;base64,${png}` });
    expect(parts[2]).toMatchObject({ type: "input_file", filename: "b.pdf", file_data: `data:application/pdf;base64,${png}` });
    expect(parts[3].text).toContain("Gate 12");
    expect(userContent("Hello", [])).toBe("Hello");
  });
});
