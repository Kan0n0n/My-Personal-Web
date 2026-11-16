import {unzipSync, strFromU8} from 'fflate';
import {fail} from './model.mjs';

export const MAX_BOOK_BYTES=50*1024*1024;
export function checkBookFile(format,bytes) {
  if (!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_BOOK_BYTES) fail('Choose a nonempty PDF or EPUB up to 50 MiB.');
  if (format==='pdf') {
    if (!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) fail('This file does not have a PDF header.');
  } else if (format==='epub') {
    try {
      let total=0,count=0;
      const archive=unzipSync(bytes,{filter:entry=>{
        if (++count>5000||(total+=entry.originalSize)>100*1024*1024) throw Error('Archive too large');
        return ['mimetype','META-INF/container.xml'].includes(entry.name);
      }});
      if (!archive.mimetype||strFromU8(archive.mimetype).trim()!=='application/epub+zip'||!archive['META-INF/container.xml']) throw Error('Invalid EPUB');
    } catch { fail('Invalid EPUB, or its expanded contents exceed 100 MiB / 5,000 files.'); }
  } else fail('Choose a PDF or EPUB file.');
  return bytes;
}
