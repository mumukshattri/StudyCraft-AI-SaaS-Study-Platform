// SM-2 spaced repetition (same core idea as Anki/SuperMemo).
// Cards you know well come back later; cards you fail come back tomorrow.
// rating scale: 0 = Again(fail), 3 = Good, 5 = Easy.
export function schedule(card, rating) {
  let { ease, interval } = card;

  if (rating < 3) {
    // Failed -> reset, review again tomorrow
    interval = 1;
  } else {
    if (interval === 0) interval = 1;        // first correct review
    else if (interval === 1) interval = 6;   // second correct review
    else interval = Math.round(interval * ease); // grow by ease factor

    // Adjust ease based on how well it was recalled
    ease = ease + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    if (ease < 1.3) ease = 1.3; // floor so intervals never collapse
  }

  return { ease, interval }; // caller sets next_review = today + interval
}
