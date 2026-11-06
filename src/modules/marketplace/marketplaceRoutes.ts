import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {z} from "zod";
import {authMiddleware} from "../../shared/http/middlewares/authMiddleware";
import {authorizeRoles} from "../../shared/http/middlewares/authorizeRoles";
import {RoleCode} from "../users/types/RoleCode";
import {MercadoPagoProvider} from "../subscriptions/providers/MercadoPagoProvider";
import {MarketplaceService} from "./MarketplaceService";
import {env} from "../../shared/config/env";
type JwtUser={sub?:string;email?:string};
const service=()=>new MarketplaceService();
export async function marketplaceRoutes(app:FastifyInstance):Promise<void>{
 app.get("/seller/oauth/callback",async(req,reply)=>{
  const query=z.object({code:z.string().min(1).max(2048).optional(),state:z.string().min(1).max(256).optional(),error:z.string().optional()}).safeParse(req.query);
  const redirect=new URL("/teacher/marketplace",env.FRONTEND_URL);
  if(!query.success||query.data.error||!query.data.code||!query.data.state){
   redirect.searchParams.set("mp","error");
   return reply.redirect(redirect.toString());
  }
  try{
   await service().completeSellerConnection(query.data.code,query.data.state);
   redirect.searchParams.set("mp","connected");
  }catch(error:unknown){
   req.log.error({err:error},"Mercado Pago seller OAuth callback failed");
   redirect.searchParams.set("mp","error");
  }
  return reply.redirect(redirect.toString());
 });
 app.get("/",async(req,reply)=>{const q=z.object({q:z.string().max(120).default(""),category:z.string().max(40).default(""),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(48).default(12)}).safeParse(req.query);if(!q.success)return reply.code(400).send({success:false});return reply.send({success:true,data:await service().list(q.data.q,q.data.category,q.data.page,q.data.limit)});});
 app.get("/:slug",async(req,reply)=>{const p=z.object({slug:z.string().min(1).max(180)}).safeParse(req.params);if(!p.success)return reply.code(400).send({success:false});return reply.send({success:true,data:await service().detail(p.data.slug)});});
 app.get("/:slug/preview/:page",async(req,reply)=>{const p=z.object({slug:z.string(),page:z.coerce.number().int().min(1).max(120)}).safeParse(req.params);if(!p.success)return reply.code(400).send({success:false});const image=await service().preview(p.data.slug,p.data.page);return reply.header("Content-Type","image/jpeg").header("Cache-Control","public,max-age=300").header("X-Content-Type-Options","nosniff").send(image);});
 app.post("/checkout",async(req,reply)=>{const p=z.object({slug:z.string(),email:z.string().email()}).safeParse(req.body);if(!p.success)return reply.code(400).send({success:false});if(req.headers.authorization){try{await req.jwtVerify();}catch{return reply.code(401).send({success:false,error:{code:"INVALID_TOKEN"}});}}const user=req.user as JwtUser|undefined;const data=await service().checkout(p.data.slug,user?.sub??null,(user?.email??p.data.email).toLowerCase());return reply.code(201).send({success:true,data});});
 app.register(async auth=>{
  auth.addHook("preHandler",authMiddleware);
  auth.get("/seller/status",{preHandler:authorizeRoles(RoleCode.TEACHER)},async(req,reply)=>{
   const user=req.user as JwtUser|undefined;
   if(!user?.sub)return reply.code(401).send({success:false});
   return reply.send({success:true,data:await service().sellerConnectionStatus(user.sub)});
  });
  auth.post("/seller/connect",{preHandler:authorizeRoles(RoleCode.TEACHER)},async(req,reply)=>{
   const user=req.user as JwtUser|undefined;
   if(!user?.sub)return reply.code(401).send({success:false});
   return reply.send({success:true,data:{authorizationUrl:await service().sellerConnectionUrl(user.sub)}});
  });
  auth.post("/products",{bodyLimit:40*1024*1024,config:{rateLimit:{max:5,timeWindow:"1 hour"}},preHandler:authorizeRoles(RoleCode.TEACHER)},(req,reply)=>createTeacherProduct(req,reply));
  auth.post("/admin/products",{bodyLimit:40*1024*1024,config:{rateLimit:{max:10,timeWindow:"1 hour"}},preHandler:authorizeRoles(RoleCode.ADMIN)},(req,reply)=>createAdminProduct(req,reply));
  auth.get("/admin/pending",{preHandler:authorizeRoles(RoleCode.ADMIN)},async(_req,reply)=>reply.send({success:true,data:await service().pending()}));
  auth.patch("/admin/:productId/review",{preHandler:authorizeRoles(RoleCode.ADMIN)},async(req,reply)=>{
   const params=z.object({productId:z.string().uuid()}).safeParse(req.params);
   const body=z.object({approved:z.boolean(),note:z.string().trim().max(1000).default("")}).safeParse(req.body);
   if(!params.success||!body.success)return reply.code(400).send({success:false,error:{code:"INVALID_REVIEW"}});
   await service().review(params.data.productId,body.data.approved,body.data.note);
   return reply.send({success:true});
  });
  auth.get("/me/purchases",async(req,reply)=>{const user=req.user as JwtUser|undefined;if(!user?.sub)return reply.code(401).send({success:false});return reply.send({success:true,data:await service().purchases(user.sub)});});
  auth.get("/me/orders/:orderId/download",async(req,reply)=>{const p=z.object({orderId:z.string().uuid()}).safeParse(req.params);const user=req.user as JwtUser|undefined;if(!p.success||!user?.sub)return reply.code(400).send({success:false});return reply.send({success:true,data:{downloadUrl:await service().download(p.data.orderId,user.sub),expiresInSeconds:120}});});
 });
}
async function createTeacherProduct(req:FastifyRequest,reply:FastifyReply):Promise<FastifyReply>{return createMarketplaceProduct(req,reply,"teacher");}
async function createAdminProduct(req:FastifyRequest,reply:FastifyReply):Promise<FastifyReply>{return createMarketplaceProduct(req,reply,"admin");}
async function createMarketplaceProduct(req:FastifyRequest,reply:FastifyReply,publisher:"teacher"|"admin"):Promise<FastifyReply>{
 const user=req.user as JwtUser|undefined;if(!user?.sub||!Buffer.isBuffer(req.body))return reply.code(400).send({success:false});
 const metadata=z.object({title:z.string().trim().min(3).max(180),description:z.string().trim().min(10).max(1000),category:z.string().trim().min(2).max(40),price:z.coerce.number().int().min(100).max(1000000),fileName:z.string().min(1).max(180)}).safeParse({title:decodeHeader(req.headers["x-marketplace-title"]),description:decodeHeader(req.headers["x-marketplace-description"]),category:decodeHeader(req.headers["x-marketplace-category"]),price:req.headers["x-marketplace-price-cents"],fileName:decodeHeader(req.headers["x-file-name"])});
 if(!metadata.success)return reply.code(400).send({success:false,error:{code:"INVALID_METADATA"}});
 const input={seller:user.sub,...metadata.data,type:String(req.headers["content-type"]??"").split(";")[0]??"",file:req.body};
 const id=publisher==="admin"?await service().createAdmin(input):await service().createTeacher(input);
 return reply.code(201).send({success:true,data:{id,status:publisher==="admin"?"PUBLISHED":"PENDING_REVIEW"}});
}
function decodeHeader(value:string | string[] | undefined):string{const normalized=Array.isArray(value)?value[0]??"":value??"";try{return decodeURIComponent(normalized);}catch{return "";}}
export async function marketplaceWebhookRoutes(app:FastifyInstance):Promise<void>{
 app.post("/marketplace",async(req:FastifyRequest,reply:FastifyReply)=>{
  if(env.MERCADO_PAGO_ENABLED!=="true")return reply.code(503).send({success:false});
  const p=z.object({id:z.union([z.string(),z.number()]).optional(),user_id:z.union([z.string(),z.number()]).optional(),type:z.string().optional(),action:z.string().optional(),data:z.object({id:z.union([z.string(),z.number()])})}).passthrough().safeParse(req.body);
  if(!p.success)return reply.code(400).send({success:false});
  const query=req.query as Record<string,string|undefined>;const id=String(p.data.data.id);const sig=req.headers["x-signature"];const rid=req.headers["x-request-id"];
  if(!new MercadoPagoProvider().validateWebhookSignature(typeof sig==="string"?sig:undefined,typeof rid==="string"?rid:undefined,query["data.id"]??id))return reply.code(401).send({success:false});
  if(p.data.type!=="payment"&&!String(p.data.action??"").startsWith("payment."))return reply.send({success:true,data:{ignored:true}});
  try{const done=await service().payment(id,String(p.data.id??`${rid??"event"}:${id}`),p.data,p.data.user_id===undefined?undefined:String(p.data.user_id));return reply.send({success:true,data:{processed:done}});}catch(error:unknown){req.log.error({err:error},"Marketplace webhook error");return reply.code(500).send({success:false});}
 });
}
