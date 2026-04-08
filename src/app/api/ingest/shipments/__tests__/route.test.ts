import { ZodError } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

const authorizeIngestRequest = vi.fn();
const ingestShipment = vi.fn();

vi.mock("@/lib/shipments/ingest", () => ({
  authorizeIngestRequest,
  ingestShipment,
}));

describe("ingest shipments route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns route metadata for GET", async () => {
    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      endpoint: "/api/ingest/shipments",
      method: "POST",
    });
  });

  it("rejects unauthorized POST requests", async () => {
    authorizeIngestRequest.mockReturnValue(false);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/ingest/shipments", {
        body: JSON.stringify({ tracking_number: "123" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns created when ingest succeeds", async () => {
    authorizeIngestRequest.mockReturnValue(true);
    ingestShipment.mockResolvedValue({
      action: "created",
      canonicalStatus: "in_transit",
      shipmentId: "ship_123",
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/ingest/shipments", {
        body: JSON.stringify({ tracking_number: "123" }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      action: "created",
      shipmentId: "ship_123",
    });
    expect(ingestShipment).toHaveBeenCalledWith({ tracking_number: "123" });
  });

  it("returns validation details for zod errors", async () => {
    authorizeIngestRequest.mockReturnValue(true);
    ingestShipment.mockRejectedValue(new ZodError([]));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/ingest/shipments", {
        body: JSON.stringify({ tracking_number: "123" }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid payload",
    });
  });
});
