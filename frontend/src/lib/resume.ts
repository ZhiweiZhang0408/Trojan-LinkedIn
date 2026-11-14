import type { ImportResult } from "../types";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;

export async function readResume(file: File): Promise<ImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx"].includes(extension || ""))
    throw new Error("Choose a PDF or DOCX resume.");
  if (!file.size)
    throw new Error("This file is empty. Please choose another resume.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a resume smaller than 5 MB.");
  const buffer = await file.arrayBuffer();
  let text = "";
  if (extension === "pdf") {
    const task = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        text +=
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join("") + "\n";
      }
    } finally {
      await task.destroy();
    }
  } else {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    text = result.value;
  }
  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 30)
    throw new Error(
      "We could not read enough text from this file. Try a text-based PDF or DOCX, or complete your profile manually.",
    );
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const name = lines.find(
    (x) =>
      x.length < 60 &&
      !/@|https?:|resume|curriculum|education|experience/i.test(x),
  );
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  const known = [
    "SQL",
    "Python",
    "Tableau",
    "Power BI",
    "Excel",
    "React",
    "JavaScript",
    "R",
    "Statistics",
    "Machine learning",
    "User research",
    "Marketing",
  ];
  const skills = known.filter((k) =>
    new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      text,
    ),
  );
  const fileData: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not store the original file."));
    reader.readAsDataURL(file);
  });
  return { text, fileName: file.name, fileData, name, email, skills };
}
