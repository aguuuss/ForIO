export type QuestionType = "multiple_choice" | "drag_and_drop" | "table_drag_and_drop";

export type SubjectSummary = {
  id: string;
  slug: string;
  name: string;
  careerName: string;
  yearNumber: number;
};

export type SubjectInput = {
  subjectSlug?: string;
  subjectName?: string;
  careerName?: string;
  yearNumber?: number;
};

export type TableCell = {
  row: number;
  col: number;
  content: string;
  isBlank: boolean;
  correctAnswer?: string;
  acceptedAnswers?: string[];
};

export type DragTable = {
  rows: number;
  columns: number;
  cells: TableCell[];
};

export type MultipleChoiceQuestion = {
  id: string;
  type: "multiple_choice";
  statement: string;
  options: string[];
  correctAnswer: string;
  ocrText?: string;
};

export type DragAndDropQuestion = {
  id: string;
  type: "drag_and_drop";
  statement: string;
  textParts: string[];
  draggableOptions: string[];
  correctAnswers: string[];
  ocrText?: string;
};

export type TableDragAndDropQuestion = {
  id: string;
  type: "table_drag_and_drop";
  statement: string;
  table: DragTable;
  draggableOptions: string[];
  ocrText?: string;
};

export type QuestionCore = MultipleChoiceQuestion | DragAndDropQuestion | TableDragAndDropQuestion;
export type Question = QuestionCore & {
  subject: SubjectSummary;
};
export type QuestionInput =
  | (Omit<MultipleChoiceQuestion, "id"> & SubjectInput)
  | (Omit<DragAndDropQuestion, "id"> & SubjectInput)
  | (Omit<TableDragAndDropQuestion, "id"> & SubjectInput);
