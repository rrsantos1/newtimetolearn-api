import { randomUUID } from "node:crypto";
import { env } from "../../shared/config/env";
import { AppError } from "../../shared/errors/AppError";
import { BackblazeStorageProvider } from "../../shared/storage/providers/BackblazeStorageProvider";
import { MarketplaceRepository } from "./MarketplaceRepository";
import { PresentationPreviewGenerator } from "./PresentationPreviewGenerator";
import { TeacherEntitlementsRepository } from "../subscriptions/repositories/TeacherEntitlementsRepository";
const TYPES=new Set(["application/pdf","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
const EXT:Record<string,string>={"application/pdf":"pdf","application/vnd.ms-powerpoint":"ppt","application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx"};
export class MarketplaceService {
 constructor(private readonly repo=new MarketplaceRepository(),private readonly storage=new BackblazeStorageProvider(),private readonly generator=new PresentationPreviewGenerator(),private readonly entitlements=new TeacherEntitlementsRepository()){}
 async list(q:string,category:string,page:number,limit:number){const data=await this.repo.list(q,category,page,limit);return {...data,page,limit,pages:Math.ceil(data.total/limit)};}
 async detail(slug:string){const product=await this.repo.detail(slug);if(!product)throw new AppError("PRODUCT_NOT_FOUND",404,"Material não encontrado.");return {...product,previews:Array.from({length:product.preview_pages},(_,i)=>({pageNumber:i+1}))};}
 async createTeacher(input:{seller:string;title:string;description:string;category:string;price:number;fileName:string;type:string;file:Buffer}):Promise<string>{
  const entitlements=await this.entitlements.findByTeacherId(input.seller);
  if(entitlements.subscriptionStatus!=="ACTIVE"||entitlements.planCode!=="TEACHER_MONTHLY")throw new AppError("ACTIVE_SUBSCRIPTION_REQUIRED",403,"É necessário ter uma assinatura ativa para publicar materiais à venda.");
  return this.create(input,"PENDING_REVIEW");
 }
 async createAdmin(input:{seller:string;title:string;description:string;category:string;price:number;fileName:string;type:string;file:Buffer}):Promise<string>{return this.create(input,"PUBLISHED");}
 private async create(input:{seller:string;title:string;description:string;category:string;price:number;fileName:string;type:string;file:Buffer},status:"PENDING_REVIEW"|"PUBLISHED"):Promise<string>{
  if(!TYPES.has(input.type))throw new AppError("INVALID_FILE_TYPE",400,"Envie PDF, PPT ou PPTX.");
  if(input.file.length>40*1024*1024||input.file.length===0)throw new AppError("INVALID_FILE_SIZE",400,"O arquivo deve ter até 40 MB.");
  const pages=await this.generator.generate(input.file,input.type);
  const folder=`marketplace/${input.seller}/${randomUUID()}`;const originalKey=`${folder}/original.${EXT[input.type]}`;const coverKey=`${folder}/cover.jpg`;
  const previewKeys=pages.map(p=>`${folder}/preview-${p.pageNumber}.jpg`);
  const tasks:Promise<void>[]=[this.storage.uploadObject({bucketName:env.B2_QUARANTINE_BUCKET_NAME!,storageKey:originalKey,contentType:input.type,body:input.file,cacheControl:"private, no-store"}),this.storage.uploadObject({bucketName:env.B2_QUARANTINE_BUCKET_NAME!,storageKey:coverKey,contentType:"image/jpeg",body:pages[0]!.buffer,cacheControl:"private, no-store"})];
  pages.forEach((p,i)=>tasks.push(this.storage.uploadObject({bucketName:env.B2_QUARANTINE_BUCKET_NAME!,storageKey:previewKeys[i]!,contentType:"image/jpeg",body:p.buffer,cacheControl:"private, max-age=300"})));
  await Promise.all(tasks);
  try{return await this.repo.create({seller:input.seller,title:input.title,description:input.description,category:input.category,price:input.price,originalKey,fileName:input.fileName.replace(/[\\/\\r\\n\\0]/g,"_").slice(0,180),type:input.type,size:input.file.length,coverKey,previewKeys,status});}
  catch(error:unknown){await Promise.all([originalKey,coverKey,...previewKeys].map(key=>this.storage.deleteObject(key,env.B2_QUARANTINE_BUCKET_NAME!))).catch(()=>undefined);throw error;}
 }
 async preview(slug:string,page:number):Promise<Buffer>{const product=await this.repo.detail(slug);if(!product)throw new AppError("PRODUCT_NOT_FOUND",404,"Material não encontrado.");const item=(await this.repo.previews(product.id)).find(p=>p.page_number===page);if(!item)throw new AppError("PREVIEW_NOT_FOUND",404,"Página não encontrada.");return (await this.storage.downloadObject(item.preview_key,env.B2_QUARANTINE_BUCKET_NAME!)).body;}
 async checkout(slug:string,buyerId:string|null,email:string){const token=env.MERCADO_PAGO_ACCESS_TOKEN;if(env.MERCADO_PAGO_ENABLED!=="true"||!token)throw new Error("MERCADO_PAGO_DISABLED");const product=await this.repo.detail(slug);if(!product)throw new AppError("PRODUCT_NOT_FOUND",404,"Material não encontrado.");const amount=Number(product.price_cents);const orderId=await this.repo.createOrder(product.id,buyerId,email,amount);
 const response=await fetch("https://api.mercadopago.com/checkout/preferences",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-Idempotency-Key":randomUUID()},body:JSON.stringify({items:[{id:orderId,title:product.title.slice(0,250),quantity:1,currency_id:"BRL",unit_price:amount/100}],payer:{email},external_reference:orderId,metadata:{order_id:orderId},notification_url:`${env.API_PUBLIC_URL}/api/v1/webhooks/marketplace`,back_urls:{success:`${env.FRONTEND_URL}/marketplace/checkout/success`,failure:`${env.FRONTEND_URL}/marketplace/checkout/failure`,pending:`${env.FRONTEND_URL}/marketplace/checkout/pending`},auto_return:"approved"}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("MARKETPLACE_PREFERENCE_FAILED");const data=await response.json() as {id?:string;init_point?:string};if(!data.id||!data.init_point)throw new Error("INVALID_PREFERENCE");await this.repo.setPreference(orderId,data.id);return {orderId,checkoutUrl:data.init_point};}
 async payment(paymentId:string,eventId:string,payload:unknown):Promise<boolean>{const token=env.MERCADO_PAGO_ACCESS_TOKEN;if(!token)throw new Error("PAYMENT_TOKEN_MISSING");const response=await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("PAYMENT_LOOKUP_FAILED");const payment=await response.json() as {id:string;status:string;external_reference:string;transaction_amount:number;currency_id:string};const order=await this.repo.order(payment.external_reference);if(!order||payment.currency_id!=="BRL"||Math.round(payment.transaction_amount*100)!==Number(order.amount_cents))throw new Error("PAYMENT_ORDER_MISMATCH");const status=payment.status==="approved"?"APPROVED":payment.status==="rejected"?"REJECTED":payment.status==="cancelled"?"CANCELLED":payment.status==="refunded"||payment.status==="charged_back"?"REFUNDED":null;if(!status)return false;return this.repo.applyPayment({orderId:order.id,paymentId:String(payment.id),eventId,status,payload});}
 async review(id:string,approved:boolean,note:string):Promise<void>{const changed=await this.repo.review(id,approved,note);if(!changed)throw new AppError("PRODUCT_NOT_PENDING",409,"Este material não está aguardando moderação.");}
 async pending(){return this.repo.pending();}
 async purchases(userId:string){return this.repo.purchases(userId);}
 async download(orderId:string,userId:string){const row=await this.repo.download(orderId,userId);if(!row)throw new AppError("DOWNLOAD_FORBIDDEN",403,"Compra não aprovada.");return this.storage.createDownloadUrl(row.key,env.B2_QUARANTINE_BUCKET_NAME!,120);}
}
