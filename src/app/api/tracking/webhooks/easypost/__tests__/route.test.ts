import { afterEach, describe, expect, it, vi } from "vitest";

const authorizeEasyPostWebhook = vi.fn();
const processEasyPostWebhook = vi.fn();

vi.mock("@/lib/shipments/provider", () => ({
  authorizeEasyPostWebhook,
  processEasyPostWebhook,
}));

describe("EasyPost webhook route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized webhook calls", async () => {
    authorizeEasyPostWebhook.mockReturnValue(false);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/tracking/webhooks/easypost", {
        body: JSON.stringify({ description: "tracker.updated" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized webhook request",
    });
  });

  it("applies authorized webhook payloads", async () => {
    authorizeEasyPostWebhook.mockReturnValue(true);
    processEasyPostWebhook.mockResolvedValue({
      action: "applied",
      shipmentId: "ship_1",
      trackerId: "trk_1",
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/tracking/webhooks/easypost", {
        body: JSON.stringify({ description: "tracker.updated", result: { id: "trk_1" } }),
        headers: {
          "content-type": "application/json",
          "x-parcel-deck-webhook-token": "secret",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      action: "applied",
      shipmentId: "ship_1",
    });
  });
});
