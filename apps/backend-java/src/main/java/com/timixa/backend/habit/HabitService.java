package com.timixa.backend.habit;

import com.timixa.backend.common.HabitNotFoundException;
import com.timixa.backend.habit.dto.HabitRequest;
import com.timixa.backend.habit.dto.HabitResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class HabitService {

    static final int STREAK_LOOKBACK_DAYS = 365;

    private final HabitRepository habits;
    private final HabitCompletionRepository completions;

    public HabitService(HabitRepository habits, HabitCompletionRepository completions) {
        this.habits = habits;
        this.completions = completions;
    }

    @Transactional(readOnly = true)
    public List<HabitResponse> findAll(UUID userId) {
        List<Habit> all = habits.findByUserIdOrderByCreatedAtDesc(userId);
        if (all.isEmpty()) return List.of();
        List<UUID> ids = all.stream().map(Habit::getId).toList();
        LocalDate today = LocalDate.now();

        Map<UUID, HabitCompletion> todaysByHabit = new HashMap<>();
        for (HabitCompletion c : completions.findByHabitIdInAndCompletedDate(ids, today)) {
            todaysByHabit.put(c.getHabitId(), c);
        }

        Map<UUID, Map<LocalDate, Integer>> historyByHabit = new HashMap<>();
        for (HabitCompletion c : completions.findByHabitIdIn(ids)) {
            historyByHabit
                .computeIfAbsent(c.getHabitId(), k -> new HashMap<>())
                .put(c.getCompletedDate(), c.getDelta());
        }

        List<HabitResponse> out = new ArrayList<>(all.size());
        for (Habit h : all) {
            int currentCount = todaysByHabit.containsKey(h.getId())
                ? todaysByHabit.get(h.getId()).getDelta() : 0;
            int streak = currentStreak(
                h, today, historyByHabit.getOrDefault(h.getId(), Map.of()));
            out.add(HabitResponse.from(h, currentCount, streak));
        }
        return out;
    }

    @Transactional
    public HabitResponse create(UUID userId, HabitRequest req) {
        Habit h = new Habit();
        h.setUserId(userId);
        h.setTitle(req.title());
        h.setCategory(req.category());
        if (req.icon() != null) h.setIcon(req.icon());
        if (req.targetCount() != null) h.setTargetCount(req.targetCount());
        if (req.unit() != null) h.setUnit(req.unit());
        if (req.color() != null) h.setColor(req.color());
        h.setGoalId(req.goalId());
        Habit saved = habits.save(h);
        return HabitResponse.from(saved, 0, 0);
    }

    @Transactional
    public HabitResponse increment(UUID userId, UUID habitId) {
        Habit h = requireOwnedHabit(userId, habitId);
        LocalDate today = LocalDate.now();
        HabitCompletion c = completions.findByHabitIdAndCompletedDate(h.getId(), today)
            .orElseGet(() -> new HabitCompletion(h.getId(), today, 0, Instant.now()));
        c.setDelta(c.getDelta() + 1);
        c.setCompletedAt(Instant.now());
        completions.save(c);

        int streak = currentStreak(h, today, allDeltasForHabit(h.getId()));
        return HabitResponse.from(h, c.getDelta(), streak);
    }

    Habit requireOwnedHabit(UUID userId, UUID habitId) {
        Habit h = habits.findById(habitId).orElseThrow(HabitNotFoundException::new);
        if (!h.getUserId().equals(userId)) throw new HabitNotFoundException();
        return h;
    }

    private Map<LocalDate, Integer> allDeltasForHabit(UUID habitId) {
        Map<LocalDate, Integer> map = new HashMap<>();
        for (HabitCompletion c : completions.findByHabitIdIn(List.of(habitId))) {
            map.put(c.getCompletedDate(), c.getDelta());
        }
        return map;
    }

    static int currentStreak(Habit h, LocalDate from, Map<LocalDate, Integer> historyByDate) {
        int target = Math.max(1, h.getTargetCount());
        int length = 0;
        LocalDate cursor = from;
        for (int i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
            int done = historyByDate.getOrDefault(cursor, 0);
            boolean hit = done >= target;
            if (cursor.equals(from) && !hit) {
                cursor = cursor.minusDays(1);
                continue;
            }
            if (!hit) break;
            length++;
            cursor = cursor.minusDays(1);
        }
        return length;
    }
}
