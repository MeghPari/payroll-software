import 'server-only';
// Stored ZIP entries avoid another compression dependency; PDFs are already compressed.
export function payslipZip(files:{name:string;bytes:Uint8Array}[]):Uint8Array{
 const chunks:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const file of files){
  const name=Buffer.from(file.name.replace(/[^A-Za-z0-9_.-]/g,'_'));
  let crc=0xffffffff;for(const byte of file.bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x21,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(file.bytes.length,18);h.writeUInt32LE(file.bytes.length,22);h.writeUInt16LE(name.length,26);
  chunks.push(h,name,Buffer.from(file.bytes));
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(file.bytes.length,20);c.writeUInt32LE(file.bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);
  offset+=h.length+name.length+file.bytes.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return new Uint8Array(Buffer.concat([...chunks,directory,end]));
}
