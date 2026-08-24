import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// 设置 pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  try {
    const pdf = await (pdfjsLib as any).getDocument({ data: typedArray }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join('') + '\n';
    }
    return text;
  } catch (e: any) {
    console.warn('PDF parse failed', e);
    return `[PDF 解析失败：${file.name}。提示：请使用 Chrome/Edge 最新版并检查文件是否可正常打开。]`;
  }
}

export async function parseDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (e) {
    console.warn('DOCX parse failed', e);
    return `[DOCX 解析失败：${file.name}]`;
  }
}

export async function parseTXT(file: File): Promise<string> {
  return await file.text();
}

export async function parseExcel(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
  return data;
}

export async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return parsePDF(file);
  if (ext === 'docx') return parseDOCX(file);
  if (['txt', 'md', 'doc'].includes(ext || '')) return parseTXT(file);
  return `[暂不支持的文件类型：.${ext}，请上传 PDF / DOCX / TXT / MD]`;
}

export function exportToExcel(data: any[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}
