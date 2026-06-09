# ForIO

ForIO is a quiz practice app for preparing course questions. This glossary names the practice-session concepts used by the app.

## Language

**Practice session**:
A run started from a selected set of questions. A practice session is completed when every selected question has been mastered.
_Avoid_: quiz attempt, run

**Practice block**:
A subset of up to 30 selected questions practiced together before moving to the next subset.
_Avoid_: page, batch

**Mastered question**:
A question within the current practice block that has been answered correctly at least once.
_Avoid_: completed question, learned question

**Pending question**:
A question within the current practice block that has not yet been mastered. A wrongly answered question remains pending and can appear again in the same block.
_Avoid_: failed question, wrong question

**Block reinsertion**:
The study rule that places a wrongly answered pending question back into a random position within the current practice block.
_Avoid_: retry queue, immediate retry

**Practice progress**:
The progress shown during a practice session. Progress is based on mastered questions within the current practice block, while attempts count every answered prompt including repeated pending questions.
_Avoid_: question number

**Practice precision**:
The percentage of attempts answered correctly during a practice session. Precision is separate from mastery because all selected questions must eventually be mastered to complete the session.
_Avoid_: final score

**Immediate feedback**:
The correction shown right after answering a question. Immediate feedback is part of the study loop and remains visible even when the question will reappear later in the same practice block.
_Avoid_: exam-style feedback, delayed correction

## Example Dialogue

Developer: "What happens when a student misses a pending question?"

Domain expert: "It stays pending and is randomly reinserted inside the same practice block."

Developer: "When does the next practice block start?"

Domain expert: "Only after every question in the current practice block is mastered. Blocks contain up to 30 selected questions, and the last block may be smaller."

Developer: "Do we hide the correct answer when a student answers wrongly?"

Domain expert: "No. The student sees immediate feedback, then studies by meeting the pending question again later."

Developer: "What should happen after finishing a practice session?"

Domain expert: "The student can restart the same selected questions as a new shuffled practice session, or return to the selector to choose a different set."
