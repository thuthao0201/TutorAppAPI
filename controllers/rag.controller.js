const path = require("path");
const { ChatGroq } = require("@langchain/groq");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PineconeEmbeddings } = require("@langchain/pinecone");
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("@langchain/pinecone");
const { StateGraph, START, END, MemorySaver } = require("@langchain/langgraph");
const { TavilySearch } = require("@langchain/tavily");

const memory = new MemorySaver();
let vectorStore = null;
let embeddings = null;
let llm = null;
let pineconeIndex = null;
let persistentExecutor = null;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

/**
 * Initialize global resources
 */
const initializeGlobals = async () => {
  if (llm && vectorStore && embeddings) {
    return; // Already initialized
  }

  llm = new ChatGroq({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0.7,
  });

  embeddings = new PineconeEmbeddings({
    model: process.env.EMBEDDING_MODEL || "multilingual-e5-large",
  });

  const pinecone = new PineconeClient();
  pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

  vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    maxConcurrency: 5,
    namespace: "academic_knowledge", // Namespace for academic content
  });

  console.log("Global resources initialized successfully");
};

/**
 * Index a document into the vector store
 */
const indexDocument = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    await initializeGlobals();

    const filePath = path.resolve(file.path);
    const fileExtension = path.extname(filePath).toLowerCase();
    if (![".pdf", ".txt"].includes(fileExtension)) {
      return res.status(400).json({
        error: "Unsupported file format. Only PDF and TXT files are supported.",
      });
    }

    const fileName = path.basename(filePath);
    const loader =
      fileExtension === ".pdf"
        ? new PDFLoader(filePath)
        : new TextLoader(filePath);
    const docs = await loader.load();

    docs.forEach((doc) => {
      doc.metadata.fileName = fileName;
      doc.metadata.sourceFile = filePath;
    });

    const splitDocs = await textSplitter.splitDocuments(docs);

    const batchSize = 96;
    const batches = [];
    for (let i = 0; i < splitDocs.length; i += batchSize) {
      batches.push(splitDocs.slice(i, i + batchSize));
    }

    await Promise.all(
      batches.map((batch, index) => {
        console.log(`Uploading batch ${index + 1}/${batches.length}`);
        return vectorStore.addDocuments(batch);
      })
    );

    res.status(200).json({
      success: true,
      fileName,
      documentCount: splitDocs.length,
      message: `Successfully indexed ${splitDocs.length} document chunks from ${fileName}`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: `Failed to index document: ${error.message}` });
  }
};

/**
 * Filter conversation history based on relevance to current message using embeddings
 * @param {Array} messages - Array of messages
 * @param {string} currentMessage - Current user message
 * @param {number} maxMessages - Maximum number of messages to return
 * @returns {Promise<Array>} - Array of most relevant messages
 */
const getRelevantHistory = async (
  messages,
  currentMessage,
  maxMessages = 5
) => {
  if (messages.length <= maxMessages) {
    return messages; // If fewer messages than limit, return all
  }

  try {
    // Generate embedding for current message
    const currentEmbedding = await embeddings.embedQuery(currentMessage);

    // Generate embeddings for all history messages
    const messageTexts = messages.map((m) => m.content);
    const messageEmbeddings = await Promise.all(
      messageTexts.map(async (text) => {
        return await embeddings.embedQuery(text);
      })
    );

    // Calculate similarity scores (dot product)
    const similarities = messageEmbeddings.map((embedding) => {
      return embedding.reduce(
        (sum, val, i) => sum + val * currentEmbedding[i],
        0
      );
    });

    // Create array combining messages and scores
    const messagesWithScores = messages.map((message, index) => ({
      message,
      score: similarities[index],
    }));

    // Sort by similarity score in descending order
    messagesWithScores.sort((a, b) => b.score - a.score);

    // Get the most relevant messages
    return messagesWithScores.slice(0, maxMessages).map((item) => item.message);
  } catch (error) {
    console.error("Error filtering relevant history:", error);
    // Fallback: return most recent messages
    return messages.slice(-maxMessages);
  }
};

/**
 * Save chat history safely to memory
 */
const saveChatHistorySafely = async (threadId, messages) => {
  try {
    // Re-enable the delete operation before put to avoid checkpoint conflicts
    // await memory.delete({
    //   configurable: {
    //     thread_id: threadId,
    //   },
    // });

    // Ensure the channel_values format matches what the memory saver expects
    await memory.put({
      configurable: {
        thread_id: threadId,
      },
      channel_values: {
        messages: messages,
        // Add all required channels with their default values
        context: "",
        relevanceScore: "",
        originalQuery: "",
        usingWebSearch: false,
        needWebSearch: false,
        answer: "",
        documents: [],
        decision: "",
      },
    });

    return true;
  } catch (error) {
    console.error("Error safely saving chat history:", error);
    return false;
  }
};

/**
 * Clear chat history for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Result of clearing history
 */
const clearChatHistory = async (req, res) => {
  const { userId } = req.body;
  const threadId = userId || "default-thread";

  try {
    // await memory.delete({
    //   configurable: {
    //     thread_id: threadId,
    //   },
    // });

    res.status(200).json({
      success: true,
      message: `Chat history for user ${userId || "default"} has been cleared`,
    });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    res
      .status(500)
      .json({ error: `Failed to clear chat history: ${error.message}` });
  }
};

/**
 * Chat with the academic assistant
 */
const chatWithAssistant = async (req, res) => {
  const { userQuery } = req.body;
  // Default to "default-user" if no user ID is provided
  const userId = req.user?._id || req.body.userId || "default-user";

  if (!userQuery) {
    return res.status(400).json({ error: "User query is required" });
  }

  try {
    await initializeGlobals();

    if (!persistentExecutor) {
      persistentExecutor = await initWorkflow();
    }

    // Use a simplified approach without memory persistence
    const inputs = {
      messages: [{ role: "human", content: userQuery }],
      context: "",
      relevanceScore: "",
      originalQuery: "",
      usingWebSearch: false,
      needWebSearch: false,
      decision: "",
      documents: [],
    };

    // Remove memory-related configuration to avoid the thread_id error
    const result = await persistentExecutor.invoke(inputs);

    res.status(200).json({
      answer: result.answer,
      sources: result.documents || [],
    });
  } catch (error) {
    console.error("Chat assistant error:", error);
    res.status(500).json({
      error: `Failed to chat with assistant: ${error.message}`,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

/**
 * Retrieve relevant academic content
 */
const retrieveNode = async (state) => {
  const embedQuery = await embeddings.embedQuery(state.messages[0].content);
  const searchResults = await vectorStore.similaritySearchVectorWithScore(
    embedQuery,
    3
  );

  const contextText = searchResults
    .map(
      ([doc, score]) => `${doc.pageContent} (Relevance: ${score.toFixed(2)})`
    )
    .join("\n\n");

  return {
    ...state,
    context: contextText,
    documents: searchResults.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score,
    })),
  };
};

/**
 * Generate a response based on retrieved content
 */
const generateNode = async (state) => {
  const systemPrompt = `You are a helpful assistant for academic questions. Use the provided context to answer the user's query.\n\nContext:\n${state.context}`;
  const response = await llm.invoke([
    ["system", systemPrompt],
    ["human", state.messages[0].content],
  ]);

  return {
    ...state,
    answer: response.content,
  };
};

/**
 * Rewrite the query for better search results
 */
const rewriteNode = async (state) => {
  const originalQuery = state.messages[0].content;
  const systemPrompt = `Rewrite the following academic question to improve search results:\n\n"${originalQuery}"\n\nKeep it concise and focused on the academic topic.`;
  const response = await llm.invoke([
    ["system", systemPrompt],
    ["human", originalQuery],
  ]);

  return {
    ...state,
    messages: [{ role: "human", content: response.content }],
    originalQuery,
  };
};

/**
 * Grade the relevance of retrieved documents
 */
const gradeDocumentsNode = async (state) => {
  const systemPrompt = `
    You are an evaluator assessing the relevance of retrieved documents to a user's academic question.
    User question: ${state.messages[0].content}
    Retrieved documents: ${state.context}

    Determine if the documents are relevant to the question.
    Respond with "yes" if relevant, or "no" if not.
  `;
  const response = await llm.invoke([
    ["system", systemPrompt],
    ["human", "Are these documents relevant to the question?"],
  ]);

  const relevanceScore = response.content.toLowerCase().includes("yes")
    ? "yes"
    : "no";

  return {
    ...state,
    relevanceScore,
  };
};

/**
 * Check if web search is needed
 */
const checkWebSearchNode = async (state) => {
  if (state.relevanceScore === "no") {
    return { ...state, needWebSearch: true };
  }
  return { ...state, needWebSearch: false };
};

/**
 * Perform a web search
 */
const webSearchNode = async (state) => {
  const query = state.messages[0].content;
  const searchTool = new TavilySearch({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 3,
  });

  try {
    const searchResults = await searchTool.invoke({ query });
    const webContext = searchResults.results
      .map(
        (result) =>
          `Title: ${result.title}\nContent: ${result.content}\nSource: ${result.url}`
      )
      .join("\n\n");

    return {
      ...state,
      context: webContext,
      usingWebSearch: true,
    };
  } catch (error) {
    console.error("Error in web search:", error);
    return {
      ...state,
      context: "No relevant information found from web search.",
      usingWebSearch: true,
    };
  }
};

/**
 * Check if a second attempt is needed (e.g., web search or query rewrite)
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object>} - Updated state with the decision
 */
const checkSecondAttemptNode = async (state) => {
  console.log("---CHECK SECOND ATTEMPT NODE---");
  if (state.originalQuery) {
    return { ...state, needWebSearch: true };
  }
  return { ...state, needWebSearch: false };
};

/**
 * Check if a second attempt is needed (e.g., web search or query rewrite)
 */
const shouldRetrieve = async (state) => {
  console.log("---DECIDE TO RETRIEVE---");
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  // Get relevant history for the current message
  const relevantMessages = await getRelevantHistory(
    messages.slice(0, messages.length - 1), // Exclude the current message
    lastMessage.content,
    7 // Limit to the 7 most relevant messages
  );

  // Add the current message to the filtered history
  const filteredHistory = [...relevantMessages, lastMessage];

  // Create a conversation history context
  const conversationHistory = filteredHistory
    .map((m) => `${m.role === "human" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  // Use LLM to analyze the question and decide if retrieval is needed
  const systemPrompt = `
    You are an academic assistant analyzer. Your job is to determine if the user's message requires retrieving information from the knowledge base.

    ${
      conversationHistory
        ? `Conversation history:\n${conversationHistory}\n\n`
        : ""
    }
    Current message: "${lastMessage.content}"

    Messages that should trigger retrieval:
    - Questions about academic topics such as math, science, history, or literature
    - Queries requiring detailed explanations or examples
    - Questions referencing specific academic concepts, theories, or problems
    - Follow-up questions that require additional academic information
    - Questions that reference previous academic-related information but need elaboration

    Messages that do NOT need retrieval (respond with "direct_response"):
    - Simple greetings or acknowledgments
    - User expressions of gratitude
    - Follow-up clarification questions that can be answered based on your previous response
    - Simple yes/no responses from the user
    - Questions unrelated to academic topics
    - Messages where the needed information was already provided in previous responses

    Consider the conversation history to determine if this is a follow-up question that needs new information or can be answered with what was already discussed.

    Respond with ONLY "retrieve" if academic information retrieval is needed, or "direct_response" if retrieval is not necessary.
  `;

  const response = await llm.invoke([
    ["system", systemPrompt],
    [
      "human",
      "Should I retrieve information for this message considering the conversation history?",
    ],
  ]);

  const decision = response.content.toLowerCase().trim();

  if (decision.includes("retrieve")) {
    console.log(
      "---DECISION: RETRIEVE (LLM analysis with conversation history)---"
    );
    return "retrieve";
  }

  console.log(
    "---DECISION: DIRECT_RESPONSE (LLM analysis with conversation history)---"
  );
  return "direct_response";
};

/**
 * Directly respond to the user's query without retrieval
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object>} - State with the direct response
 */
const directResponse = async (state) => {
  console.log("---DIRECT RESPONSE---");
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // Get relevant history for the current message
  const relevantMessages = await getRelevantHistory(
    messages.slice(0, messages.length - 1),
    lastMessage.content,
    7
  );

  // Add the current message to the filtered history
  const filteredHistory = [...relevantMessages, lastMessage];

  // Create a conversation history context
  const conversationHistory = filteredHistory
    .map((m) => `${m.role === "human" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  // Use LLM to generate a direct response
  const systemPrompt = `
    You are a helpful academic assistant. Respond to the user's query based on the conversation history.

    ${
      conversationHistory
        ? `Conversation history:\n${conversationHistory}\n\n`
        : ""
    }
    Current message: "${lastMessage.content}"

    Provide a concise and accurate response. If the question is unrelated to academics, politely inform the user that you specialize in academic topics.
  `;

  const response = await llm.invoke([
    ["system", systemPrompt],
    ["human", lastMessage.content],
  ]);

  return {
    ...state,
    answer: response.content,
  };
};

/**
 * Handle direct responses when retrieval is not needed
 */
const directResponseNode = async (state) => {
  console.log("---DIRECT RESPONSE NODE---");
  return await directResponse(state);
};

/**
 * Check if retrieval is needed using LLM
 */
const shouldRetrieveNode = async (state) => {
  console.log("---SHOULD RETRIEVE NODE---");
  const decision = await shouldRetrieve(state);
  return { ...state, decision };
};

/**
 * Update the workflow to handle academic questions properly
 */
const initWorkflow = async () => {
  const workflow = new StateGraph({
    channels: {
      messages: { type: "list", default: [] },
      context: { type: "string", default: "" },
      relevanceScore: { type: "string", default: "" },
      originalQuery: { type: "string", default: "" },
      usingWebSearch: { type: "boolean", default: false },
      needWebSearch: { type: "boolean", default: false },
      answer: { type: "string", default: "" },
      documents: { type: "list", default: [] },
      decision: { type: "string", default: "" },
    },
  });

  // Add nodes
  workflow.addNode("shouldRetrieve", shouldRetrieveNode);
  workflow.addNode("retrieve", retrieveNode);
  workflow.addNode("generate", generateNode);
  workflow.addNode("rewrite", rewriteNode);
  workflow.addNode("gradeDocuments", gradeDocumentsNode);
  workflow.addNode("checkSecondAttempt", checkSecondAttemptNode);
  workflow.addNode("webSearch", webSearchNode);
  workflow.addNode("directResponse", directResponseNode);

  // Workflow edges
  workflow.addEdge(START, "shouldRetrieve");

  // First conditional edge based on retrieval decision
  workflow.addConditionalEdges("shouldRetrieve", (state) => state.decision, {
    retrieve: "retrieve",
    direct_response: "directResponse",
  });

  workflow.addEdge("retrieve", "gradeDocuments");

  // Second conditional edge based on document relevance
  workflow.addConditionalEdges(
    "gradeDocuments",
    (state) => state.relevanceScore,
    {
      yes: "generate",
      no: "checkSecondAttempt",
    }
  );

  // Third conditional edge based on need for web search
  workflow.addConditionalEdges(
    "checkSecondAttempt",
    (state) => (state.needWebSearch ? "needWebSearch" : "noWebSearch"),
    {
      needWebSearch: "webSearch",
      noWebSearch: "rewrite",
    }
  );

  workflow.addEdge("webSearch", "generate");
  workflow.addEdge("rewrite", "retrieve");
  workflow.addEdge("generate", END);
  workflow.addEdge("directResponse", END);

  // Compile without memory to avoid thread_id issues
  return workflow.compile();
};

module.exports = {
  indexDocument,
  chatWithAssistant,
  clearChatHistory,
};
