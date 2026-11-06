import {beforeEach,describe,expect,it,vi} from "vitest";
const query=vi.fn();
const transaction=vi.fn();
vi.mock("../../../src/shared/database/data-source",()=>({AppDataSource:{query:(...args:unknown[])=>query(...args),transaction:(...args:unknown[])=>transaction(...args)}}));
import {MarketplaceRepository} from "../../../src/modules/marketplace/MarketplaceRepository";
describe("MarketplaceRepository",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("lista somente materiais publicados e respeita paginação",async()=>{
  query.mockResolvedValueOnce([{id:"p1",title:"Aula"}]).mockResolvedValueOnce([{total:"1"}]);
  const result=await new MarketplaceRepository().list("aula","Apresentação",2,12);
  expect(result.items).toHaveLength(1);expect(result.total).toBe(1);
  expect(query).toHaveBeenNthCalledWith(1,expect.stringContaining("p.status='PUBLISHED'"),["aula","Apresentação",12,12]);
 });
 it("não expõe materiais não publicados pelo slug",async()=>{
  query.mockResolvedValueOnce([]);
  await expect(new MarketplaceRepository().detail("draft-material")).resolves.toBeNull();
 });
 it("vincula compras de visitante apenas a usuário com e-mail verificado",async()=>{
  query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  await new MarketplaceRepository().purchases("user-1");
  expect(query).toHaveBeenNthCalledWith(1,expect.stringContaining("u.email_verified_at IS NOT NULL"),["user-1"]);
  expect(query).toHaveBeenNthCalledWith(2,expect.stringContaining("o.status='APPROVED'"),["user-1"]);
 });
 it("só altera produtos que aguardam moderação",async()=>{
  query.mockResolvedValueOnce([{id:"p1"}]);
  await expect(new MarketplaceRepository().review("p1",true,"ok")).resolves.toBe(true);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("status='PENDING_REVIEW'"),["p1","PUBLISHED","ok"]);
 });
});
