const { OpenAI } = require("openai");
const { zodTextFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const dotenv = require("dotenv");
const util = require("util");
const fs = require("fs");
dotenv.config();

const EntitiesSchema = z.object({
  attributes: z.array(z.string()),
  colors: z.array(z.string()),
  animals: z.array(z.string()),
});

const openai = new OpenAI();

(async () => {
  const assistant = await openai.beta.assistants.create({
    name: "ExtractorAssistant",
    instructions: "You are an expert in extracting content from a pdf file",
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
  });

  console.log("uploading file");
  const file = await openai.files.create({
    file: fs.createReadStream("files/PresentationBookA-Grade1.pdf"),
    purpose: "assistants",
  });

  console.log("creating thread");
  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: "user",
        content: "extract the content of the given pdf file",
        attachments: [{ file_id: file.id, tools: [{ type: "file_search" }] }],
      },
    ],
  });

  // The thread now has a vector store in its tool resources.
  console.log(thread);

  const stream = openai.beta.threads.runs
    .stream(thread.id, {
      assistant_id: assistant.id,
    })
    .on("textCreated", () => console.log("assistant >"))
    .on("toolCallCreated", (event) => console.log("assistant " + event.type))
    .on("messageDone", async (event) => {
      console.log("messageDone");
      console.log(
        util.inspect(event, { showHidden: false, depth: null, colors: true })
      );
    });

  //   await uploadFilesToVectorStore(assistant);

  //
  //   const stream = openai.responses
  //     .stream({
  //       model: "gpt-4.1",
  //       input: [
  //         { role: "user", content: "What's the weather like in Paris today?" },
  //       ],
  //       text: {
  //         format: zodTextFormat(EntitiesSchema, "entities"),
  //       },
  //     })
  //     .on("response.refusal.delta", (event) => {
  //       console.log("refusal", event);
  //       //   process.stdout.write(event.delta);
  //     })
  //     .on("response.output_text.delta", (event) => {
  //       console.log("delta");
  //       //   process.stdout.write(event.delta);
  //     })
  //     .on("response.output_text.done", () => {
  //       console.log("done");
  //       process.stdout.write("\n");
  //     })
  //     .on("response.error", (event) => {
  //       console.log("error", event);
  //       console.error(event.error);
  //     });

  //   const result = await stream.finalResponse();

  //   console.log(
  //     util.inspect(result, { showHidden: false, depth: null, colors: true })
  //   );
})();

async function uploadFilesToVectorStore(assistant) {
  const fileStreams = ["files/PresentationBookA-Grade1.pdf"].map((path) =>
    fs.createReadStream(path)
  );

  // Create a vector store including our two files.
  let vectorStore = await openai.vectorStores.create({
    name: "ExtractorVectorStore",
  });

  await openai.vectorStores.fileBatches.uploadAndPoll(
    vectorStore.id,
    fileStreams
  );

  await openai.beta.assistants.update(assistant.id, {
    tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
  });
}
