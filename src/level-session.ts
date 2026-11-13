import { loadLevel, type LevelDefinition } from "./level-format";

export const EDITOR_DRAFT_KEY = "squarenaut-editor-draft";

export function readEditorDraft(storage: Storage): LevelDefinition {
  const contents = storage.getItem(EDITOR_DRAFT_KEY);
  if (contents === null) {
    throw new Error("No editor draft is available to test.");
  }
  return loadLevel(JSON.parse(contents));
}

export function writeEditorDraft(storage: Storage, level: LevelDefinition): void {
  storage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(loadLevel(level)));
}
