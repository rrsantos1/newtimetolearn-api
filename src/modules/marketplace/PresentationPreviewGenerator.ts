import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
const run=promisify(execFile);
const MAX_BYTES=40*1024*1024;
const MAX_PAGES=120;
export interface PreviewPage { pageNumber:number; buffer:Buffer; }
export class PresentationPreviewGenerator {
 async generate(file:Buffer,contentType:string):Promise<PreviewPage[]> {
  if(file.length===0||file.length>MAX_BYTES)throw new Error("MARKETPLACE_FILE_SIZE_INVALID");
  const extension=contentType==="application/pdf"?"pdf":contentType==="application/vnd.ms-powerpoint"?"ppt":contentType==="application/vnd.openxmlformats-officedocument.presentationml.presentation"?"pptx":"";
  if(!extension)throw new Error("MARKETPLACE_FILE_TYPE_INVALID");
  const dir=await mkdtemp(join(tmpdir(),"ttl-marketplace-"));
  try{
   const input=join(dir,`source.${extension}`);
   await writeFile(input,file,{flag:"wx"});
   const pdf=extension==="pdf"?input:join(dir,"source.pdf");
   if(extension!=="pdf")await run("libreoffice",["--headless","--convert-to","pdf","--outdir",dir,input],{timeout:120000,maxBuffer:4*1024*1024});
   const pdfInfo=await run("pdfinfo",[pdf],{timeout:15000,maxBuffer:1024*1024});\n   const pageCount=Number(pdfInfo.stdout.match(/^Pages:\\s+(\\d+)$/m)?.[1]??0);\n   if(pageCount<1||pageCount>MAX_PAGES)throw new Error("MARKETPLACE_PAGE_COUNT_INVALID");
   await run("pdftoppm",["-jpeg","-jpegopt","quality=78","-r","105","-f","1","-l",String(MAX_PAGES),pdf,join(dir,"slide")],{timeout:120000,maxBuffer:4*1024*1024});
   const names=(await readdir(dir)).filter(name=>/^slide-\d+\.jpg$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0]??0)-Number(b.match(/\d+/)?.[0]??0));
   if(names.length===0||names.length>MAX_PAGES)throw new Error("MARKETPLACE_PAGE_COUNT_INVALID");
   const result:PreviewPage[]=[];
   for(let index=0;index<names.length;index+=1){
    const source=await readFile(join(dir,names[index]!));
    const meta=await sharp(source).metadata();
    const width=meta.width??1200;const height=meta.height??900;
    const watermark=Buffer.from(`<svg width="${width}" height="${height}"><g transform="rotate(-25 ${width/2} ${height/2})"><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="${Math.max(24,width/18)}" font-weight="700" fill="#222" fill-opacity=".25">TIMETOLEARN • PRÉVIA</text></g><text x="50%" y="96%" text-anchor="middle" font-family="Arial" font-size="${Math.max(12,width/75)}" fill="#222" fill-opacity=".55">Material protegido • Uso demonstrativo</text></svg>`);
    result.push({pageNumber:index+1,buffer:await sharp(source).composite([{input:watermark}]).jpeg({quality:78,mozjpeg:true}).toBuffer()});
   }
   return result;
  }finally{await rm(dir,{recursive:true,force:true});}
 }
}
