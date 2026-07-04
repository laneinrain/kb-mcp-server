import { Command } from "commander";
import { runDelete } from "./commands/delete.js";
import { runIngest } from "./commands/ingest.js";
import { runList } from "./commands/list.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("kb")
    .description("Knowledge base admin CLI")
    .exitOverride();

  program
    .command("ingest")
    .description("Ingest a file or directory into the knowledge base")
    .argument("<path>", "File or directory path")
    .option(
      "--collection <name>",
      "Target collection name",
      "default",
    )
    .action(async (path: string, options: { collection: string }) => {
      const code = await runIngest(path, options.collection);
      process.exitCode = code;
    });

  program
    .command("list")
    .description("List indexed documents")
    .action(async () => {
      const code = await runList();
      process.exitCode = code;
    });

  program
    .command("delete")
    .description("Delete a document and its vectors")
    .argument("<documentId>", "Document ID")
    .action(async (documentId: string) => {
      const code = await runDelete(documentId);
      process.exitCode = code;
    });

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as Error & { code?: string }).code;
      if (
        code === "commander.helpDisplayed" ||
        code === "commander.version"
      ) {
        return;
      }
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
});
