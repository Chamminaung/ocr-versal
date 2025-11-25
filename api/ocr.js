import multer from "multer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";

// Disable default body parser (we handle multipart manually)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Handle multipart form upload
  upload.array("images")(req, res, async (err) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image files received" });
    }

    const results = [];

    try {
      // Sequential OCR to avoid memory spikes
      for (const file of req.files) {
        const tempPath = path.join("/tmp", `${Date.now()}-${file.originalname}`);
        fs.writeFileSync(tempPath, file.buffer);

        const { data } = await Tesseract.recognize(tempPath, "eng+mya", {
          logger: (m) => console.log(`[Tesseract] ${file.originalname}`, m),
        });

        results.push({
          fileName: file.originalname,
          text: data.text,
        });

        fs.unlinkSync(tempPath);
      }

      return res.status(200).json({ success: true, results });
    } catch (e) {
      console.error("OCR error:", e);
      return res.status(500).json({ error: "OCR failed", details: e.message });
    }
  });
}
