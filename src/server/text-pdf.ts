import 'server-only';import 'regenerator-runtime/runtime.js';
import { readFile } from 'node:fs/promises';import { join } from 'node:path';import { PDFDocument,rgb } from 'pdf-lib';import fontkit from '@pdf-lib/fontkit';
export async function textPdf(title:string,lines:{text:string;size?:number}[]){
 const document=await PDFDocument.create();document.registerFontkit(fontkit);const font=await document.embedFont(await readFile(join(process.cwd(),'assets','fonts','NotoSansDevanagari.ttf')),{subset:true}),available=new Set(font.getCharacterSet());document.setTitle(title);
 let page=document.addPage([595,842]),y=785;
 for(const entry of lines){const size=entry.size??10,text=entry.text.replace(/[\r\n\t]/g,' ');if([...text].some(character=>!available.has(character.codePointAt(0)!)))throw new Error('DOCUMENT_FONT_UNSUPPORTED');
 const draw=(value:string)=>{if(y<55){page=document.addPage([595,842]);y=785;}page.drawText(value,{x:45,y,font,size,color:rgb(.12,.16,.22)});y-=size+10;};let segment='';for(const character of text){if(segment&&font.widthOfTextAtSize(segment+character,size)>505){draw(segment);segment='';}segment+=character;}draw(segment);
 }
 const pages=document.getPages();for(let index=0;index<pages.length;index++)pages[index].drawText(`Page ${index+1} of ${pages.length}`,{x:45,y:25,font,size:8,color:rgb(.4,.4,.4)});return document.save();
}
