export type QuestionType = "multiple_choice" | "drag_and_drop" | "table_drag_and_drop";
export type QuestionPartial = "2do parcial";

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
  partial?: QuestionPartial;
};

export type DragAndDropQuestion = {
  id: string;
  type: "drag_and_drop";
  statement: string;
  textParts: string[];
  draggableOptions: string[];
  correctAnswers: string[];
  ocrText?: string;
  partial?: QuestionPartial;
};

export type TableDragAndDropQuestion = {
  id: string;
  type: "table_drag_and_drop";
  statement: string;
  table: DragTable;
  draggableOptions: string[];
  ocrText?: string;
  partial?: QuestionPartial;
};

export type Question = MultipleChoiceQuestion | DragAndDropQuestion | TableDragAndDropQuestion;

export type QuestionInput =
  | (Omit<MultipleChoiceQuestion, "id"> & { id?: string })
  | (Omit<DragAndDropQuestion, "id"> & { id?: string })
  | (Omit<TableDragAndDropQuestion, "id"> & { id?: string });
