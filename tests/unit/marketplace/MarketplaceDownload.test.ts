import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceService } from "../../../src/modules/marketplace/MarketplaceService";
import { MarketplaceRepository } from "../../../src/modules/marketplace/MarketplaceRepository";
import { BackblazeStorageProvider } from "../../../src/shared/storage/providers/BackblazeStorageProvider";
import { PresentationPreviewGenerator } from "../../../src/modules/marketplace/PresentationPreviewGenerator";
import { TeacherEntitlementsRepository } from "../../../src/modules/subscriptions/repositories/TeacherEntitlementsRepository";
import { MarketplaceSellerAccountService } from "../../../src/modules/marketplace/MarketplaceSellerAccountService";

describe("MarketplaceDownload", () => {
  let findDownload: ReturnType<typeof vi.fn>;
  let createDownloadUrl: ReturnType<typeof vi.fn>;
  let service: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    findDownload = vi.fn().mockResolvedValue({ key: "marketplace/product/original.pdf" });
    createDownloadUrl = vi.fn().mockResolvedValue("https://storage.example/signed-download");
    service = new MarketplaceService(
      { download: findDownload } as unknown as MarketplaceRepository,
      { createDownloadUrl } as unknown as BackblazeStorageProvider,
      {} as PresentationPreviewGenerator,
      {} as TeacherEntitlementsRepository,
      {} as MarketplaceSellerAccountService,
    );
  });

  it("creates a short-lived signed URL for an approved purchase", async () => {
    await expect(service.download("order-1", "buyer-1")).resolves.toBe(
      "https://storage.example/signed-download",
    );

    expect(findDownload).toHaveBeenCalledWith("order-1", "buyer-1");
    expect(createDownloadUrl).toHaveBeenCalledOnce();
    expect(createDownloadUrl.mock.calls[0]?.[0]).toBe("marketplace/product/original.pdf");
    expect(createDownloadUrl.mock.calls[0]?.[2]).toBe(120);
  });

  it("does not create a download URL when the purchase is not authorized", async () => {
    findDownload.mockResolvedValue(null);

    await expect(service.download("order-2", "different-user")).rejects.toMatchObject({
      code: "DOWNLOAD_FORBIDDEN",
      statusCode: 403,
    });

    expect(createDownloadUrl).not.toHaveBeenCalled();
  });
});
