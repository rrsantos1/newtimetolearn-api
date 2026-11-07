import {beforeEach,describe,expect,it,vi} from "vitest";
const query=vi.fn();
const transaction=vi.fn();
const managerQuery=vi.fn();
vi.mock("../../../src/shared/database/data-source",()=>({AppDataSource:{query:(...args:unknown[])=>query(...args),transaction:(...args:unknown[])=>transaction(...args)}}));
import {MarketplaceRepository} from "../../../src/modules/marketplace/MarketplaceRepository";
describe("MarketplaceRepository",()=>{
 beforeEach(()=>{vi.clearAllMocks();transaction.mockImplementation(async (callback:(manager:{query:typeof managerQuery})=>Promise<unknown>)=>callback({query:managerQuery}));});
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

 it("aplica um pagamento aprovado e registra o evento de forma transacional",async()=>{
  managerQuery.mockResolvedValueOnce([{id:"event-1"}]).mockResolvedValueOnce([{id:"order-1"}]).mockResolvedValueOnce([]);
  await expect(new MarketplaceRepository().applyPayment({
   orderId:"order-1",paymentId:"payment-1",eventId:"event-1",status:"APPROVED",payload:{status:"approved"},
  })).resolves.toBe(true);
  expect(transaction).toHaveBeenCalledOnce();
  expect(managerQuery).toHaveBeenNthCalledWith(1,expect.stringContaining("ON CONFLICT(provider_event_id) DO NOTHING"),["event-1","order-1",JSON.stringify({status:"approved"})]);
  expect(managerQuery).toHaveBeenNthCalledWith(2,expect.stringContaining("SET status=$2"),["order-1","APPROVED","payment-1"]);
  expect(managerQuery).toHaveBeenNthCalledWith(3,expect.stringContaining("SET processed_at=CURRENT_TIMESTAMP"),["event-1"]);
 });
 it("ignora eventos de pagamento duplicados sem atualizar o pedido",async()=>{
  managerQuery.mockResolvedValueOnce([]);
  await expect(new MarketplaceRepository().applyPayment({
   orderId:"order-1",paymentId:"payment-1",eventId:"duplicate-event",status:"APPROVED",payload:{},
  })).resolves.toBe(false);
  expect(managerQuery).toHaveBeenCalledOnce();
 });
 it("falha a transação quando o pedido do evento não existe",async()=>{
  managerQuery.mockResolvedValueOnce([{id:"event-2"}]).mockResolvedValueOnce([]);
  await expect(new MarketplaceRepository().applyPayment({
   orderId:"missing-order",paymentId:"payment-2",eventId:"event-2",status:"APPROVED",payload:{},
  })).rejects.toThrow("MARKETPLACE_ORDER_NOT_FOUND");
  expect(managerQuery).toHaveBeenCalledTimes(2);
 });
 it("autoriza download somente para compra aprovada do próprio comprador e arquivo",async()=>{
  query.mockResolvedValueOnce([]);
  await expect(new MarketplaceRepository().download("order-1","buyer-1")).resolves.toBeNull();
  expect(query).toHaveBeenCalledWith(expect.stringContaining("o.buyer_user_id=$2 AND o.status='APPROVED' AND p.delivery_type='FILE'"),["order-1","buyer-1"]);
 });

});
