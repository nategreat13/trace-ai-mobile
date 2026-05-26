import { Router, Request, Response } from "express";
import * as admin from "firebase-admin";
import { colRef } from "../firebase";
import { sendToUser } from "../lib/push";

export const shareRoutes = Router();

// POST /share-deal
// Creates a sharedDeals doc and returns the shareId.
shareRoutes.post("/share-deal", async (req: Request, res: Response) => {
  const { dealSnapshot, sharerId, sharerName } = req.body;
  if (!dealSnapshot || !sharerId || !sharerName) {
    res.status(400).json({ error: "dealSnapshot, sharerId, sharerName required" });
    return;
  }
  try {
    const ref = await colRef("sharedDeals").add({
      dealSnapshot,
      sharerId,
      sharerName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      openedAt: null,
      openedByUserId: null,
    });
    res.json({ shareId: ref.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[share] create failed:", msg);
    res.status(500).json({ error: "Failed to create share" });
  }
});

// GET /share-deal/:shareId
// Returns the share record so the app can render the deal.
shareRoutes.get("/share-deal/:shareId", async (req: Request, res: Response) => {
  const shareId = req.params.shareId as string;
  try {
    const doc = await colRef("sharedDeals").doc(shareId).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    res.json({ shareId: doc.id, ...doc.data() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[share] fetch failed:", msg);
    res.status(500).json({ error: "Failed to fetch share" });
  }
});

// POST /share-deal/:shareId/opened
// Marks the share as opened and notifies the original sharer.
shareRoutes.post("/share-deal/:shareId/opened", async (req: Request, res: Response) => {
  const shareId = req.params.shareId as string;
  const { openedByUserId, openerName } = req.body;
  if (!openedByUserId || !openerName) {
    res.status(400).json({ error: "openedByUserId, openerName required" });
    return;
  }
  try {
    const docRef = colRef("sharedDeals").doc(shareId);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    const data = doc.data()!;

    // Only notify once — ignore if already opened
    if (data.openedAt) {
      res.json({ ok: true, alreadyOpened: true });
      return;
    }

    await docRef.update({
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      openedByUserId,
    });

    const destination = data.dealSnapshot?.destination ?? "a deal";
    await sendToUser(data.sharerId, {
      title: "They opened it 👀",
      body: `${openerName} opened your ${destination} deal`,
      data: { deepLink: "/dashboard?tab=saved" },
    });

    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[share] opened failed:", msg);
    res.status(500).json({ error: "Failed to mark share opened" });
  }
});
