# Recon Agent

A multi-agent AI system designed to conduct deep internet research, synthesize findings, and write comprehensive reports autonomously. Built for the Fenrir Security engineering challenge.

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- NVIDIA NIM API keys (or other compatible LLM provider keys)

### 1. Installation
Clone the repository (do not fork or make public), then install the workspace dependencies from the root directory:
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory (or in `packages/backend/`) with your API keys and a secret for JWT authentication:
```env
# Database and Auth
JWT_SECRET=your_secure_random_string_here

# LLM Provider Keys (NVIDIA NIM, DeepInfra, etc.)
QWEN_API_KEY=your_nvidia_nim_key_here
MINIMAX_API_KEY=your_minimax_key_here
# Any other keys referenced in the agent files
```

### 3. Running the Application
From the root directory, start both the frontend and backend concurrently:
```bash
npm run dev
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

The application will automatically provision the local SQLite database (`packages/backend/research.db`) on the first run.

---

## Architecture Overview

The system uses a highly decoupled, multi-agent architecture. Instead of relying on a single monolithic LLM prompt, the workload is distributed across four specialized agents to improve accuracy, depth, and output formatting.

1. **Orchestrator Agent**
   - **Role**: The supervisor.
   - **Function**: It oversees the entire research pipeline. It decomposes the user's initial topic into specific research sub-questions, delegates tasks to the appropriate specialized agents, and ensures comprehensive coverage of the topic.

2. **Research Agent**
   - **Role**: The gatherer. It is equipped with tools to search the live internet and scrape webpage content.
   - **Function**: Given a user topic or sub-question from the orchestrator, it iteratively searches the web (using parallel tool calling) to aggregate raw facts, statistics, and source URLs. It stops once it has sufficient verifiable information.

3. **Analysis Agent**
   - **Role**: The synthesizer. It does not have access to the internet.
   - **Function**: It ingests the massive wall of raw text produced by the Research Agent. Its strict prompt forces it to be objective—filtering out noise, highlighting contradictions, and structuring the raw data into a clean, evidence-based format.

4. **Writing Agent**
   - **Role**: The publisher. 
   - **Function**: It receives the structured analysis (and raw data context) and is tasked exclusively with writing a polished, comprehensive Markdown report (complete with an Executive Summary and Source References).

---

## How Mastra is Used

We leverage the **Mastra TypeScript SDK** as the core engine for LLM orchestration. Here is how it powers the application:

- **Agent Instantiation**: We define distinct `Agent` instances in `packages/backend/src/mastra/agents/`. Mastra allows us to securely inject custom system prompts, select specific models, and configure provider endpoints (we use the `openai/` Vercel AI SDK prefix trick to route requests to NVIDIA NIM).
- **Native Tool Calling**: Mastra natively handles the complexities of LLM tool calling. By simply passing our custom `webSearchTool` into the Research Agent's initialization, Mastra automatically exposes the JSON schema to the model and executes the TypeScript tool functions when the LLM requests them.
- **Observability and Metrics**: Under the hood, Mastra returns rich data about the execution loop. We parse `result.usage` (for token counts) and `result.steps` (for granular tool arguments/results) directly from Mastra's output. We then record this data into our local SQLite database to power the custom Observability Dashboard. 
- **Pipeline Orchestration**: While Mastra provides its own Workflow primitives, we orchestrate the sequential hand-off using our `orchestratorAgent` combined with our Express route (`research.ts`). This supervisor pattern allows us to dynamically delegate sub-tasks to specialized agents while intercepting the transitions to stream real-time Server-Sent Events (SSE) down to the React frontend, creating a live, interactive user experience.
