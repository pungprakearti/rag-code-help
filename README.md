# Local Code Assistant (RAG)

A prototype for a lightweight Retrieval-Augmented Generation (RAG) tool built with **Node.js**, **LangChain**, and **Ollama**. This application allows you to index a local code file and ask an AI model questions about it using local vector embeddings.

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Ollama** installed and running on your machine. You can download it at [ollama.com](https://ollama.com/).

Once Ollama is installed, pull the required models in your terminal:

```
# Model for text embeddings
ollama pull nomic-embed-text

# LLM optimized for coding
ollama pull qwen2.5-coder:7b
```

### 2. Installation

Clone the repository, navigate into the directory, and install the dependencies:
```
git clone https://github.com/pungprakearti/rag-code-help
cd rag-code-help
npm install
```

### 3. Usage

By default, the script looks for a file named sampleCode.tsx in the root directory. Once your file is in place, run:
```
node codeHelp.mjs
```

### 🔍 Troubleshooting
Ollama Connection

If the script fails to connect, ensure that the Ollama server is active.

The application is configured to look for Ollama at http://127.0.0.1:11434. If you are running Ollama on a different port, a different local address, or a remote server, update the OLLAMA_URL constant at the top of codeHelp.mjs:

```
const OLLAMA_URL = 'http://127.0.0.1:11434'; // Ensure this points to your Ollama server
```

### Build Issues

Since hnswlib-node compiles from source, ensure you have build essentials installed (like python, make, and g++ on Ubuntu/WSL).
How it Works

    Ingestion: Reads the source file and splits it into chunks using RecursiveCharacterTextSplitter.

    Vectorization: Generates embeddings for each chunk via nomic-embed-text.

    Local Storage: Saves the vectors into a local directory (local_index_data) using HNSWLib.

    Retrieval & Generation: When a query is run, the app retrieves the most relevant code blocks and passes them to qwen2.5-coder:7b to generate a concise, context-aware response.

### What problem does this solve?

Running LLMs locally on consumer hardware—such as a GPU with 8GB of VRAM—presents a significant challenge when dealing with large codebases. Standard "copy-paste" prompting quickly exhausts the available VRAM and context window, leading to crashes or severe performance degradation.

This setup implements a RAG (Retrieval-Augmented Generation) workflow to bypass these hardware limitations. By splitting code into semantic chunks and indexing them locally, the system only injects the most relevant snippets into the model's active memory. In short: it enables hardware with limited VRAM to effectively process and analyze datasets spanning hundreds of thousands of tokens.