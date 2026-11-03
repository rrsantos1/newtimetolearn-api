BEGIN;

-- Register Word Matching and Sentence Completion as supported activity types.
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS chk_activities_type;

ALTER TABLE public.activities
  ADD CONSTRAINT chk_activities_type
  CHECK (
    type IN (
      'quiz',
      'word_search',
      'crossword',
      'cloze',
      'multiple_choice',
      'fill_in_the_blank',
      'drag_drop',
      'sentence_order',
      'board_game',
      'roulette',
      'hangman',
      'memory',
      'listening',
      'fill_in_blanks',
      'mole_hit',
      'word_matching',
      'sentence_completion'
    )
  );

COMMIT;
