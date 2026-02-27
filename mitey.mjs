import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import readline from "readline";
import { scanContext } from "./apiScan.mjs";
import { chatWithContext } from "./apiChat.mjs";

// --- Configuration ---
const CONFIG = {
  ollamaUrl: "http://127.0.0.1:11434",
  dbPath: "./local_index_data",
  srcDirectory: "./sampleCode",
  embeddings: new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: "http://127.0.0.1:11434",
  }),
  model: new ChatOllama({
    model: "qwen2.5-coder:7b",
    temperature: 0,
    baseUrl: "http://127.0.0.1:11434",
    numPredict: -1,
    numCtx: 8192,
    repeatPenalty: 1.1,
  }),
};

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

const main = async () => {
  try {
    // 1. Initial Scan
    const fileList = await scanContext(
      CONFIG.srcDirectory,
      CONFIG.embeddings,
      CONFIG.dbPath,
    );

    const chatHistory = [];

    console.log("\n--- mitey System Ready ---");

    while (true) {
      const query = await askQuestion("\nmitey > ");
      if (query.toLowerCase() === "exit") break;

      const aiResponse = await chatWithContext(
        query,
        chatHistory,
        fileList,
        CONFIG,
      );

      console.log("\nAI:", aiResponse);

      chatHistory.push(["user", query]);
      chatHistory.push(["assistant", aiResponse]);
    }
  } catch (error) {
    console.error("Fatal Error:", error.message);
  }
};

main();
