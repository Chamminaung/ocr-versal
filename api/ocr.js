import multer from "multer";
import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js-node";

// Disable default body parser
export const config = {
  api: { bodyParser: false },
};

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  upload.array("images")(req, res, async (err) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image files received" });
    }

    const results = [];

    // Create Tesseract worker once
    const worker = createWorker({
      cachePath: "/tmp",
      logger: (m) => console.log("[Tesseract]", m),
    });

    try {
      await worker.load();
      await worker.loadLanguage("eng+mya");
      await worker.initialize("eng+mya");

      // Sequential OCR to avoid memory spikes
      for (const file of req.files) {
        const tempPath = path.join("/tmp", `${Date.now()}-${file.originalname}`);
        fs.writeFileSync(tempPath, file.buffer);

        const { data } = await worker.recognize(tempPath);

        results.push({
          fileName: file.originalname,
          text: data.text,
        });

        fs.unlinkSync(tempPath);
      }

      await worker.terminate();

      return res.status(200).json({ success: true, results });
    } catch (e) {
      console.error("OCR error:", e);
      return res.status(500).json({ error: "OCR failed", details: e.message });
    }
  });
}
