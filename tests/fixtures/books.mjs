import {zipSync,strToU8} from 'fflate';
export function samplePDF(withText=false) {
  const stream=withText?'BT /F1 18 Tf 25 350 Td (Hello novel reader.) Tj ET':'';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << ${withText?'/Font << /F1 6 0 R >>':''} >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << ${withText?'/Font << /F1 6 0 R >>':''} >> /Contents 4 0 R >>`
  ];
  if(withText)objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf='%PDF-1.4\n',offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
export function sampleEPUB() {
  return Buffer.from(zipSync({
    mimetype:strToU8('application/epub+zip'),
    'META-INF/container.xml':strToU8('<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OPS/package.opf':strToU8('<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>'),
    'OPS/one.xhtml':strToU8('<html><body><h1>Chapter one</h1><p>Hello 世界 ♡</p><img src="cover.png" alt="Cover"><script>window.hacked=true</script><img src="https://evil.invalid/track.png" onerror="alert(1)"><iframe src="https://evil.invalid"></iframe><a href="javascript:alert(1)">Bad link</a><form><input name="owner"></form><style>body{display:none}</style></body></html>'),
    'OPS/two.xhtml':strToU8('<html><body><h1>Chapter two</h1><p>The next volume awaits.</p></body></html>'),
    'OPS/cover.png':new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64'))
  }));
}
