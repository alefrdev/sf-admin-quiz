const PROGRESS_KEY = 'sf_quiz_progress_v1';
const SEEN_KEY = 'sf_quiz_seen_v1';

function getProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function updateProgress(questionId, isCorrect) {
  const progress = getProgress();
  const key = String(questionId);
  const entry = progress[key] || { failCount: 0, pendingReview: false };

  if (!isCorrect) {
    entry.failCount += 1;
    entry.pendingReview = true;
  } else if (entry.pendingReview) {
    entry.pendingReview = false;
  } else {
    return progress;
  }

  progress[key] = entry;
  saveProgress(progress);
  return progress;
}

function getPendingReviewIds(progress) {
  return Object.keys(progress)
    .filter(id => progress[id].pendingReview)
    .map(Number);
}

function getRevisionEntries(progress) {
  return Object.keys(progress)
    .filter(id => progress[id].failCount > 0)
    .map(id => ({ id: Number(id), failCount: progress[id].failCount }))
    .sort((a, b) => b.failCount - a.failCount);
}

function getSeenIds() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markSeen(questionId) {
  const seen = getSeenIds();
  if (!seen.includes(questionId)) {
    seen.push(questionId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }
  return seen;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getProgress,
    saveProgress,
    updateProgress,
    getPendingReviewIds,
    getRevisionEntries,
    getSeenIds,
    markSeen,
    PROGRESS_KEY,
    SEEN_KEY
  };
}
