import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import fs from "fs/promises";
import path from "path";

export async function chatWithContext(
  userQuery,
  history,
  allFileNames,
  config,
) {
  const { embeddings, model, dbPath } = config;
  console.log(`[CHAT] Processing query: "${userQuery}"`);

  const savedStore = await HNSWLib.load(dbPath, embeddings);
  let context = "";

  // Hybrid Search Logic
  const mentionedFile = allFileNames.find((name) =>
    userQuery.toLowerCase().includes(path.basename(name).toLowerCase()),
  );

  if (mentionedFile) {
    const fullContent = await fs.readFile(
      path.join(process.cwd(), mentionedFile),
      "utf-8",
    );
    context = `[File: ${mentionedFile}]\n${fullContent}`;
  } else {
    const searchResults = await savedStore.similaritySearch(userQuery, 6);
    context = searchResults
      .map((res) => `[File: ${res.metadata.source}]\n${res.pageContent}`)
      .join("\n---\n");
  }

  const systemMessage = [
    "system",
    `Your name is Mitey. You are small, but mighty! Act as a highly skilled assistant. Project files: ${allFileNames.join(", ")}.
    Use the context to answer. State which file you are referring to.`,
  ];

  const currentMessage = [
    "user",
    `Context snippets:\n${context}\n\nQuestion: ${userQuery}`,
  ];

  const fullPrompt = [systemMessage, ...history, currentMessage];
  const response = await model.invoke(fullPrompt);
  return response.content;
}
