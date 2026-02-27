import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const OLLAMA_URL = "http://127.0.0.1:11434";
const SRC_DIRECTORY = "./sampleCode";
const DB_PATH = "./local_index_data";

// --- Setup AI Models ---
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: OLLAMA_URL,
});

const model = new ChatOllama({
  model: "qwen2.5-coder:7b",
  temperature: 0,
  baseUrl: OLLAMA_URL,
});

// --- Utilities ---
const getElapsed = (start) => ((performance.now() - start) / 1000).toFixed(2);

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    }),
  );
  return Array.prototype.concat(...files);
}

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
};

// --- Main Execution ---
const runLocalAI = async () => {
  try {
    const totalStart = performance.now();

    // 1. Ingestion Phase
    const step1Start = performance.now();
    console.log(`Scanning directory: ${SRC_DIRECTORY}...`);

    const allFilePaths = await getFiles(SRC_DIRECTORY);
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

    const allFileNames = [...new Set(docs.map((d) => d.metadata.source))];
    console.log(
      `⏱️  Processed ${docs.length} chunks from ${allFileNames.length} files: ${getElapsed(step1Start)}s`,
    );

    // 2. Vector Indexing
    const step2Start = performance.now();
    console.log("Updating local vector database...");
    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
    await vectorStore.save(DB_PATH);
    console.log(`⏱️  Vector DB Updated: ${getElapsed(step2Start)}s`);

    // 3. User Interaction Phase
    console.log("\n--- Local Code RAG Ready ---");
    const userQuery = await askQuestion(
      "What would you like to know about these files? ",
    );

    if (!userQuery) return;

    // 4. Smart Retrieval (Hybrid Search)
    const step3Start = performance.now();
    let context = "";

    // Check if user is asking for a specific file by name
    const mentionedFile = allFileNames.find((name) =>
      userQuery.toLowerCase().includes(path.basename(name).toLowerCase()),
    );

    if (mentionedFile) {
      console.log(`Direct Match Found: Fetching ${mentionedFile} from disk...`);
      // Fail-safe: Read the actual file to ensure the AI sees 100% of it
      const fullContent = await fs.readFile(
        path.join(process.cwd(), mentionedFile),
        "utf-8",
      );
      context = `[File: ${mentionedFile}]\n${fullContent}`;
    } else {
      const savedStore = await HNSWLib.load(DB_PATH, embeddings);
      const searchResults = await savedStore.similaritySearch(userQuery, 6);
      context = searchResults
        .map((res) => `[File: ${res.metadata.source}]\n${res.pageContent}`)
        .join("\n---\n");
    }

    console.log(`⏱️  Context Retrieval: ${getElapsed(step3Start)}s`);

    // 5. AI Response
    const step4Start = performance.now();
    const systemPrompt = `Act as a highly skilled, thoughtful, and concise assistant. 
        You are analyzing a project containing these files: ${allFileNames.join(", ")}.

        Start directly with the answer. Use a professional yet warm tone. 
        If full file content is provided in the context, use it to answer precisely.
        Clearly state which file you are referring to.`;

    const response = await model.invoke([
      ["system", systemPrompt],
      ["user", `Retrieved context:\n${context}\n\nQuestion: ${userQuery}`],
    ]);

    console.log("\nAI Results:");
    console.log("--------------------------------------------------");
    console.log(response.content);
    console.log("--------------------------------------------------");

    console.log(`\n✅ AI Response Generation: ${getElapsed(step4Start)}s`);
    console.log(`✅ Total Session Time: ${getElapsed(totalStart)}s`);
  } catch (error) {
    console.error("Error:", error.message);
  }
};

runLocalAI();
