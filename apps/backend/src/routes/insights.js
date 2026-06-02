const router = require('express').Router();
const db = require('../db');

router.get('/summary', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(req.userId);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(req.userId);
  const events = db.prepare('SELECT * FROM events WHERE user_id = ?').all(req.userId);

  const totalHabits = habits.length;
  const completed = habits.filter(h => h.current_count >= h.target_count).length;
  const streak = habits.length ? Math.max(...habits.map(h => h.streak)) : 0;

  const focusMinutes = events
    .filter(e => e.type === 'habit')
    .reduce((sum, e) => {
      const [sh, sm] = e.start_time.split(':').map(Number);
      const [eh, em] = e.end_time.split(':').map(Number);
      return sum + (eh * 60 + em - (sh * 60 + sm));
    }, 0);

  const goalMap = new Map();
  for (const h of habits) {
    const gid = h.goal_id || 'General';
    if (!goalMap.has(gid)) goalMap.set(gid, []);
    goalMap.get(gid).push(h);
  }

  const goals = [...goalMap.entries()].map(([name, hs]) => {
    const rate = Math.round((hs.filter(h => h.current_count >= h.target_count).length / hs.length) * 100);
    return {
      goalName: name,
      category: hs[0].category || name,
      completionRate: rate,
      trend: 'flat',
    };
  });

  const overallScore = totalHabits > 0 ? Math.round((completed / totalHabits) * 100) : 0;
  const tasksDone = tasks.filter(t => t.status === 'done').length;

  res.json({
    overallScore,
    streak,
    focusHours: Math.round((focusMinutes / 60) * 10) / 10,
    totalHabits,
    goals,
    deepAnalysis: [
      {
        title: 'Habit Consistency',
        status: overallScore >= 70 ? 'verified' : 'warning',
        score: overallScore,
      },
      {
        title: 'Task Completion',
        status: tasks.length > 0 && tasksDone >= tasks.length * 0.5 ? 'verified' : 'info',
        insight: `${tasksDone} of ${tasks.length} tasks done`,
      },
    ],
    timeDistribution: [
      { label: 'Habits', hours: Math.round((focusMinutes / 60) * 10) / 10, color: '#e4dfff' },
      { label: 'Tasks', hours: tasks.filter(t => t.status !== 'done').length * 0.5, color: '#c2e8ff' },
    ],
    individualSync: overallScore,
    teamSync: 75,
  });
});

module.exports = router;
