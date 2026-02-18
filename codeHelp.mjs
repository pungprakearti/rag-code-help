import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";

const OLLAMA_URL = "http://127.0.0.1:11434";

const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: OLLAMA_URL,
});

const model = new ChatOllama({
  model: "qwen2.5-coder:7b",
  temperature: 0,
  baseUrl: OLLAMA_URL,
});

const FILE_PATH = "./sampleCode.tsx";
const DB_PATH = "./local_index_data";

const getElapsed = (start) => ((performance.now() - start) / 1000).toFixed(2);

const runLocalAI = async () => {
  try {
    const totalStart = performance.now();

    // 1. Read the code file and split into chunks
    const step1Start = performance.now();
    console.log("Reading file...");
    const rawCode = await fs.readFile(FILE_PATH, "utf-8");

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });
    const docs = await splitter.createDocuments(
      [rawCode],
      [{ source: FILE_PATH }],
    );
    console.log(
      `⏱️  Split into ${docs.length} chunks: ${getElapsed(step1Start)}s`,
    );

    // 2. Send chunks to Ollama for embedding and to save in local database
    const step2Start = performance.now();
    console.log("Analyzing and saving to local database...");
    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
    await vectorStore.save(DB_PATH);
    console.log(`⏱️  Embedding & Saving (GPU): ${getElapsed(step2Start)}s`);

    // 3. Searching for relevant chunks based on user query
    const step3Start = performance.now();
    const userQuery =
      "Tell me about each block of this file. Summarize what each block is doing.";
    console.log(`Data Saved! Now asking the query: ${userQuery}`);

    const savedStore = await HNSWLib.load(DB_PATH, embeddings);

    const searchResults = await savedStore.similaritySearch(userQuery, 2);
    const context = searchResults.map((res) => res.pageContent).join("\n---\n");
    console.log(`⏱️  Context Retrieval: ${getElapsed(step3Start)}s`);

    // 4. Get AI response
    const step4Start = performance.now();
    const claudeLikePrompt = `Act as a highly skilled, thoughtful, and concise assistant. Your goal is to provide helpful, intellectually honest,
        and nuanced responses while maintaining a natural, conversational tone. Please adhere to the following stylistic guidelines:

        Be Direct: Avoid lengthy introductions, flowery transitions, or concluding summaries unless they add genuine value. Start directly with the answer.

        Tone and Style: Use a professional yet warm and understated tone. Avoid over-the-top enthusiasm or repetitive 'AI-isms' like "As an AI language
            model" or "It is important to remember."

        Intellectual Honesty: If a topic is complex, acknowledge the nuances. If you are unsure about a fact, state your uncertainty clearly rather than guessing.

        Coding Philosophy: When writing code, prioritize readability and modern best practices. Provide brief, meaningful comments rather than explaining
            every single line of syntax.

        Conciseness: Value the user's time. If a question can be answered in two sentences, do not write five. Use bullet points for readability but keep
            the prose around them lean.`;

    const response = await model.invoke([
      ["system", `${claudeLikePrompt}`],
      [
        "user",
        `Here is the relevant code:\n${context}\n\nQuestion: ${userQuery}`,
      ],
    ]);
    console.log(`⏱️  AI Response Generation: ${getElapsed(step4Start)}s`);

    console.log("\nAI Results:");
    console.log(response.content);
    console.log(`\n✅ Total Process Time: ${getElapsed(totalStart)}s`);
  } catch (error) {
    console.error("Error:", error.message);
  }
};

runLocalAI();
