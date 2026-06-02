const router = require('express').Router();
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

router.post('/', (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).end();

  db.exec(
    `DELETE FROM push_subscriptions; DELETE FROM reminders; DELETE FROM events;
     DELETE FROM meetings; DELETE FROM tasks; DELETE FROM habits;
     DELETE FROM projects; DELETE FROM users;`,
  );

  const userId = randomUUID();
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, 'Maneesha', 'demo@timixa.com', bcrypt.hashSync('demo123', 10), 'admin');

  const insertProject = db.prepare(
    'INSERT INTO projects (id,user_id,title,description,priority,status,progress,due_date,tags,color) VALUES (?,?,?,?,?,?,?,?,?,?)',
  );
  insertProject.run('p1', userId, 'Website Redesign', 'Revamping core landing pages', 'high', 'active', 68, '2026-05-20', JSON.stringify(['Design', 'Frontend']), '#451de3');
  insertProject.run('p2', userId, 'Mobile App MVP', 'First version of iOS/Android habit tracker', 'high', 'active', 42, '2026-06-15', JSON.stringify(['Mobile', 'React Native']), '#006688');
  insertProject.run('p3', userId, 'API Integration', 'Connecting third-party health data APIs', 'medium', 'active', 25, '2026-05-30', JSON.stringify(['Backend', 'API']), '#4b4f52');
  insertProject.run('p4', userId, 'Analytics Dashboard', 'Insights module for enterprise clients', 'medium', 'paused', 15, '2026-07-01', JSON.stringify(['Analytics', 'Charts']), '#451de3');

  const insertTask = db.prepare(
    'INSERT INTO tasks (id,project_id,user_id,title,status,due_date,assignees,priority,duration_minutes,remaining_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)',
  );
  insertTask.run('t1', 'p1', userId, 'User interview synthesis', 'todo', '2026-05-10', JSON.stringify([userId]), 'high', 60, 60);
  insertTask.run('t2', 'p1', userId, 'Mobile navigation prototype', 'todo', '2026-05-12', JSON.stringify([userId]), 'medium', 0, 0);
  insertTask.run('t3', 'p1', userId, 'Homepage copy review', 'in-progress', '2026-05-08', JSON.stringify([userId]), 'high', 0, 0);
  insertTask.run('t4', 'p1', userId, 'Design system tokens update', 'in-progress', '2026-05-09', JSON.stringify([userId]), 'medium', 0, 0);
  insertTask.run('t5', 'p1', userId, 'Project kick-off meeting', 'done', '2026-04-30', JSON.stringify([userId]), 'low', 0, 0);
  insertTask.run('t6', 'p1', userId, 'Stakeholder presentation', 'done', '2026-05-01', JSON.stringify([userId]), 'high', 0, 0);
  insertTask.run('t7', 'p2', userId, 'Onboarding flow wireframes', 'todo', '2026-05-15', JSON.stringify([userId]), 'high', 45, 45);
  insertTask.run('t8', 'p2', userId, 'Auth module implementation', 'in-progress', '2026-05-20', JSON.stringify([userId]), 'high', 0, 0);
  insertTask.run('t9', 'p2', userId, 'Push notification setup', 'done', '2026-04-28', JSON.stringify([userId]), 'medium', 0, 0);
  insertTask.run('t10', 'p3', userId, 'API schema definition', 'todo', '2026-05-18', JSON.stringify([userId]), 'medium', 90, 90);

  const insertHabit = db.prepare(
    'INSERT INTO habits (id,user_id,title,category,icon,target_count,current_count,unit,goal_id,streak,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  );
  insertHabit.run('h1', userId, 'Study (2 hrs)', 'Learning', 'menu_book', 120, 45, 'min', 'g1', 7, '#e4dfff');
  insertHabit.run('h2', userId, 'Drink Water', 'Health', 'water_drop', 10, 4, 'glasses', 'g2', 14, '#c2e8ff');
  insertHabit.run('h3', userId, 'Morning Run', 'Fitness', 'directions_run', 5, 5, 'km', 'g2', 21, '#e4dfff');
  insertHabit.run('h4', userId, 'Meditate', 'Wellness', 'self_improvement', 20, 20, 'min', 'g3', 5, '#c2e8ff');
  insertHabit.run('h5', userId, 'Read a Book', 'Learning', 'auto_stories', 30, 10, 'pages', 'g1', 3, '#e4dfff');
  insertHabit.run('h6', userId, 'Deep Work', 'Work', 'laptop', 4, 2, 'hrs', 'g4', 9, '#e3e6e9');

  const insertEvent = db.prepare(
    'INSERT INTO events (id,user_id,title,type,date,start_time,end_time,color,source_task_id) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  insertEvent.run('e1', userId, 'Deep Work Session', 'habit', '2026-05-04', '09:00', '11:00', '#451de3', null);
  insertEvent.run('e2', userId, 'Team Standup', 'meeting', '2026-05-04', '11:00', '11:30', '#006688', null);
  insertEvent.run('e3', userId, 'Design Review', 'task', '2026-05-04', '14:00', '15:00', '#4b4f52', null);
  insertEvent.run('e4', userId, 'Morning Run', 'habit', '2026-05-05', '07:00', '07:45', '#451de3', null);
  insertEvent.run('e5', userId, 'Product Planning', 'meeting', '2026-05-05', '10:00', '11:30', '#006688', null);
  insertEvent.run('e6', userId, 'Study Session', 'habit', '2026-05-06', '08:00', '10:00', '#451de3', null);
  insertEvent.run('e7', userId, 'Code Review', 'task', '2026-05-06', '13:00', '14:00', '#4b4f52', null);
  insertEvent.run('e8', userId, 'Sprint Retrospective', 'meeting', '2026-05-07', '15:00', '16:00', '#006688', null);
  insertEvent.run('e9', userId, 'Meditation', 'habit', '2026-05-08', '07:00', '07:20', '#451de3', null);
  insertEvent.run('e10', userId, 'Client Demo', 'meeting', '2026-05-08', '14:00', '15:00', '#006688', null);

  const insertReminder = db.prepare(
    `INSERT INTO reminders (id,user_id,title,description,time,type,icon,icon_color)
     VALUES (?,?,?,?,?,?,?,?)`,
  );
  insertReminder.run(randomUUID(), userId, 'Study session in 30 min', 'You have a 2-hour study block scheduled', 'In 30 min', 'smart', 'menu_book', '#451de3');
  insertReminder.run(randomUUID(), userId, 'Drink water reminder', 'You have only logged 4 of 10 glasses today', 'Now', 'smart', 'water_drop', '#006688');

  res.json({ ok: true, userId, email: 'demo@timixa.com', password: 'demo123' });
});

module.exports = router;
