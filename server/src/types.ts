export type QuestionType = "multiple_choice" | "drag_and_drop" | "table_drag_and_drop" | "matching_dropdown" | "numeric_answer";
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

export type MatchingPair = {
  label: string;
  correctAnswer: string;
};

export type MatchingDropdownQuestion = {
  id: string;
  type: "matching_dropdown";
  statement: string;
  pairs: MatchingPair[];
  options: string[];
  ocrText?: string;
  partial?: QuestionPartial;
};

export type NumericAnswerQuestion = {
  id: string;
  type: "numeric_answer";
  statement: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  ocrText?: string;
  partial?: QuestionPartial;
};

export type Question = MultipleChoiceQuestion | DragAndDropQuestion | TableDragAndDropQuestion | MatchingDropdownQuestion | NumericAnswerQuestion;

export type QuestionInput =
  | (Omit<MultipleChoiceQuestion, "id"> & { id?: string })
  | (Omit<DragAndDropQuestion, "id"> & { id?: string })
  | (Omit<TableDragAndDropQuestion, "id"> & { id?: string })
  | (Omit<MatchingDropdownQuestion, "id"> & { id?: string })
  | (Omit<NumericAnswerQuestion, "id"> & { id?: string });
