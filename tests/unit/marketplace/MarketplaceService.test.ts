import {beforeEach,describe,expect,it,vi} from "vitest";
import {MarketplaceService} from "../../../src/modules/marketplace/MarketplaceService";
import {MarketplaceRepository} from "../../../src/modules/marketplace/MarketplaceRepository";
import {BackblazeStorageProvider} from "../../../src/shared/storage/providers/BackblazeStorageProvider";
import {PresentationPreviewGenerator} from "../../../src/modules/marketplace/PresentationPreviewGenerator";
import {TeacherEntitlementsRepository} from "../../../src/modules/subscriptions/repositories/TeacherEntitlementsRepository";

const create=vi.fn();
const archiveProduct=vi.fn();
const sellerProducts=vi.fn();
const uploadObject=vi.fn();
const deleteObject=vi.fn();
const generate=vi.fn();
const findByTeacherId=vi.fn();

const input={seller:"teacher-1",title:"Material de teste",description:"Descrição de material para teste.",category:"Apresentação",price:1990,fileName:"material.pdf",type:"application/pdf",file:Buffer.from("pdf-content")};

function makeService():MarketplaceService{
 const repository={create,archiveProduct,sellerProducts} as unknown as MarketplaceRepository;
 const storage={uploadObject,deleteObject} as unknown as BackblazeStorageProvider;
 const generator={generate} as unknown as PresentationPreviewGenerator;
 const entitlements={findByTeacherId} as unknown as TeacherEntitlementsRepository;
 return new MarketplaceService(repository,storage,generator,entitlements);
}

describe("MarketplaceService publishing permissions",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  create.mockResolvedValue("product-1");
  archiveProduct.mockResolvedValue(true);
  sellerProducts.mockResolvedValue([]);
  uploadObject.mockResolvedValue(undefined);
  deleteObject.mockResolvedValue(undefined);
  generate.mockResolvedValue([{pageNumber:1,buffer:Buffer.from("preview"),thumbnailBuffer:Buffer.from("thumbnail-webp")}]);
 });

 it("archives a product through the repository",async()=>{
  await expect(makeService().archiveProduct("product-1","teacher-1",false)).resolves.toBeUndefined();
  expect(archiveProduct).toHaveBeenCalledWith("product-1","teacher-1",false);
 });

 it("rejects attempts to archive products that do not belong to the caller",async()=>{
  archiveProduct.mockResolvedValue(false);
  await expect(makeService().archiveProduct("product-2","teacher-1",false)).rejects.toThrow("sem permissão");
 });

 it("allows active subscribers to submit products for admin review",async()=>{
  findByTeacherId.mockResolvedValue({planCode:"TEACHER_MONTHLY",subscriptionStatus:"ACTIVE"});
  await expect(makeService().createTeacher(input)).resolves.toBe("product-1");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({status:"PENDING_REVIEW",publisherType:"TEACHER",seller:"teacher-1"}));
 });

 it("blocks teachers without an active paid subscription",async()=>{
  findByTeacherId.mockResolvedValue({planCode:"FREE",subscriptionStatus:"FREE"});
  await expect(makeService().createTeacher(input)).rejects.toThrow("assinatura ativa");
  expect(generate).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
 });

 it("publishes admin products immediately without checking a teacher subscription",async()=>{
  await expect(makeService().createAdmin(input)).resolves.toBe("product-1");
  expect(findByTeacherId).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledWith(expect.objectContaining({status:"PUBLISHED",publisherType:"ADMIN",seller:"teacher-1"}));
 });
 it("stores Google Slides copy URLs and generates a watermarked preview",async()=>{
  await expect(makeService().createAdminExternal({
   seller:"admin-1",title:"Slides de teste",description:"Material de apresentação para teste.",category:"Apresentação",price:2500,
   externalUrl:"https://docs.google.com/presentation/d/abc_123/edit?usp=sharing",previewFile:Buffer.from("preview-pdf"),
  })).resolves.toBe("product-1");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
   deliveryType:"EXTERNAL_URL",
   externalUrl:"https://docs.google.com/presentation/d/abc_123/copy",
   previewKeys:expect.arrayContaining([expect.stringContaining("/preview-1.jpg")]),
   coverKey:expect.stringContaining("/cover.webp"),
   status:"PUBLISHED",
   originalKey:null,
  }));
  expect(generate).toHaveBeenCalledWith(Buffer.from("preview-pdf"),"application/pdf");
  expect(uploadObject).toHaveBeenCalledTimes(2);
  expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
   contentType:"image/webp",
   body:Buffer.from("thumbnail-webp"),
   storageKey:expect.stringContaining("/cover.webp"),
  }));
 });

 it("rejects URLs outside Google Slides",async()=>{
  await expect(makeService().createAdminExternal({
   seller:"admin-1",title:"Slides de teste",description:"Material de apresentação para teste.",category:"Apresentação",price:2500,
   externalUrl:"https://example.com/presentation",previewFile:Buffer.from("preview-pdf"),
  })).rejects.toThrow("somente links do Google Slides");
  expect(create).not.toHaveBeenCalled();
 });

});
