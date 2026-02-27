import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";
import path from "path";

export async function scanContext(directory, embeddings, dbPath) {
  console.log(`[SCAN] Initializing index for: ${directory}...`);

  const getFiles = async (dir) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
      }),
    );
    return Array.prototype.concat(...files);
  };

  const allFilePaths = await getFiles(directory);
  const validExtensions = [".tsx", ".ts", ".js", ".jsx", ".md"];
  const docs = [];
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
  });

  for (const filePath of allFilePaths) {
    if (validExtensions.includes(path.extname(filePath))) {
      const content = await fs.readFile(filePath, "utf-8");
      const fileDocs = await splitter.createDocuments(
        [content],
        [{ source: path.relative(process.cwd(), filePath) }],
      );
      docs.push(...fileDocs);
    }
  }

  const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
  await vectorStore.save(dbPath);

  const fileList = [...new Set(docs.map((d) => d.metadata.source))];
  console.log(`[SCAN] Success. Indexed ${fileList.length} files.`);
  return fileList;
}
