package com.timixa.backend.insights;

import com.timixa.backend.insights.dto.BedtimeSummaryResponse;
import com.timixa.backend.insights.dto.DaySummary;
import com.timixa.backend.insights.dto.GoalSummary;
import com.timixa.backend.insights.dto.InsightSummaryResponse;
import com.timixa.backend.insights.dto.StreakResponse;
import com.timixa.backend.insights.dto.TimeBlock;
import com.timixa.backend.insights.dto.TimeOfDayPerformance;
import com.timixa.backend.insights.dto.TomorrowSummary;
import com.timixa.backend.task.ExceptionType;
import com.timixa.backend.task.PlannedTask;
import com.timixa.backend.task.PlannedTaskCompletion;
import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskException;
import com.timixa.backend.task.PlannedTaskExceptionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
import com.timixa.backend.task.PlannedTaskService;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class InsightsService {

    static final int STREAK_LOOKBACK_DAYS = 365;

    private final PlannedTaskService taskService;
    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;
    private final PlannedTaskExceptionRepository exceptions;

    public InsightsService(PlannedTaskService taskService,
                           PlannedTaskRepository tasks,
                           PlannedTaskCompletionRepository completions,
                           PlannedTaskExceptionRepository exceptions) {
        this.taskService = taskService;
        this.tasks = tasks;
        this.completions = completions;
        this.exceptions = exceptions;
    }

    @Transactional(readOnly = true)
    public BedtimeSummaryResponse bedtime(UUID userId, LocalDate date) {
        List<PlannedTaskResponse> todayForUser = taskService.findForDate(userId, date);
        List<PlannedTaskResponse> pending = todayForUser.stream()
            .filter(t -> !t.completedToday())
            .toList();

        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, Map<LocalDate, ExceptionType>> exByTask = exceptionsByTaskAndDate(all);
        Map<UUID, Set<LocalDate>> completionsByTask = completionsByTaskAndDate(all);

        StreakResponse topStreak = null;
        StreakResponse topMissed = null;
        for (PlannedTask t : all) {
            int s = currentStreak(t, date, exByTask.getOrDefault(t.getId(), Map.of()),
                completionsByTask.getOrDefault(t.getId(), Set.of()), true);
            int m = currentStreak(t, date, exByTask.getOrDefault(t.getId(), Map.of()),
                completionsByTask.getOrDefault(t.getId(), Set.of()), false);
            if (s > 0 && (topStreak == null || s > topStreak.length())) {
                topStreak = new StreakResponse(t.getId(), t.getTitle(), s);
            }
            if (m > 0 && (topMissed == null || m > topMissed.length())) {
                topMissed = new StreakResponse(t.getId(), t.getTitle(), m);
            }
        }

        TomorrowSummary tomorrow = computeTomorrow(userId, date.plusDays(1));
        return new BedtimeSummaryResponse(date, pending, topStreak, topMissed, tomorrow);
    }

    @Transactional(readOnly = true)
    public InsightSummaryResponse summary(UUID userId, int days) {
        int window = Math.max(7, Math.min(days, 90));
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(window - 1L);
        ZoneId zone = ZoneId.systemDefault();

        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, Map<LocalDate, ExceptionType>> exByTask = exceptionsByTaskAndDate(all);
        Map<UUID, Map<LocalDate, PlannedTaskCompletion>> compByTask = completionRowsByTask(all);

        List<DaySummary> dayList = new ArrayList<>();
        int totalApplicable = 0;
        int totalCompleted = 0;
        int adherent = 0;
        int completedWithSlots = 0;

        // per-goal accumulators: [applicableFirstHalf, completedFirstHalf, applicableSecondHalf, completedSecondHalf]
        Map<String, int[]> goalAcc = new LinkedHashMap<>();
        Map<String, double[]> timeAcc = new LinkedHashMap<>();
        Map<String, String> colorByLabel = new HashMap<>();
        // per time-of-day bucket: [applicable, completed]
        Map<String, int[]> bucketAcc = new LinkedHashMap<>();
        LocalDate midpoint = start.plusDays(window / 2L);

        for (LocalDate d = start; !d.isAfter(today); d = d.plusDays(1)) {
            int applicable = 0;
            int completed = 0;
            boolean secondHalf = !d.isBefore(midpoint);
            for (PlannedTask t : all) {
                LocalDate created = t.getCreatedAt() == null
                    ? start : t.getCreatedAt().atZone(zone).toLocalDate();
                if (d.isBefore(created)) continue;
                if (!PlannedTaskService.appliesOn(t, d, exByTask.getOrDefault(t.getId(), Map.of()))) continue;

                applicable++;
                PlannedTaskCompletion c = compByTask.getOrDefault(t.getId(), Map.of()).get(d);
                boolean done = c != null && c.getCount() >= PlannedTaskService.targetFor(t);
                if (done) completed++;

                String goalName = (t.getGoal() == null || t.getGoal().isBlank()) ? null : t.getGoal().trim();
                if (goalName != null) {
                    int[] acc = goalAcc.computeIfAbsent(goalName, k -> new int[4]);
                    acc[secondHalf ? 2 : 0]++;
                    if (done) acc[secondHalf ? 3 : 1]++;
                }

                boolean timeBased = (t.getMinTimeMinutes() != null && t.getMinTimeMinutes() > 0)
                    || (t.getStartTime() != null && t.getEndTime() != null);
                if (timeBased && c != null && c.getCount() > 0) {
                    String label = goalName != null ? goalName : t.getTitle();
                    timeAcc.computeIfAbsent(label, k -> new double[1])[0] += c.getCount() / 60.0;
                    colorByLabel.putIfAbsent(label, t.getColor());
                }

                if (t.getStartTime() != null && t.getEndTime() != null) {
                    int[] bucket = bucketAcc.computeIfAbsent(
                        timeOfDayLabel(t.getStartTime()), k -> new int[2]);
                    bucket[0]++;
                    if (done) bucket[1]++;
                }

                if (done && t.getStartTime() != null && t.getEndTime() != null) {
                    completedWithSlots++;
                    if (isAdherent(t, d, c.getCompletedAt(), zone)) adherent++;
                }
            }
            totalApplicable += applicable;
            totalCompleted += completed;
            dayList.add(new DaySummary(d, applicable, completed,
                applicable == 0 ? 0 : Math.round(100f * completed / applicable)));
        }

        int discipline = totalApplicable == 0 ? 0 : Math.round(100f * totalCompleted / totalApplicable);
        int adherence = completedWithSlots == 0 ? 0 : Math.round(100f * adherent / completedWithSlots);

        Map<UUID, Set<LocalDate>> completedDatesByTask = completionsByTaskAndDate(all);
        StreakResponse topStreak = null;
        for (PlannedTask t : all) {
            int s = currentStreak(t, today, exByTask.getOrDefault(t.getId(), Map.of()),
                completedDatesByTask.getOrDefault(t.getId(), Set.of()), true);
            if (s > 0 && (topStreak == null || s > topStreak.length())) {
                topStreak = new StreakResponse(t.getId(), t.getTitle(), s);
            }
        }

        List<GoalSummary> goals = new ArrayList<>();
        for (Map.Entry<String, int[]> e : goalAcc.entrySet()) {
            int[] a = e.getValue();
            int applicableAll = a[0] + a[2];
            int completedAll = a[1] + a[3];
            int rate = applicableAll == 0 ? 0 : Math.round(100f * completedAll / applicableAll);
            int firstRate = a[0] == 0 ? 0 : Math.round(100f * a[1] / a[0]);
            int secondRate = a[2] == 0 ? 0 : Math.round(100f * a[3] / a[2]);
            String trend = secondRate > firstRate ? "up" : (secondRate < firstRate ? "down" : "flat");
            goals.add(new GoalSummary(e.getKey(), rate, trend));
        }
        goals.sort(Comparator.comparingInt(GoalSummary::completionRate).reversed());

        List<TimeBlock> distribution = new ArrayList<>();
        for (Map.Entry<String, double[]> e : timeAcc.entrySet()) {
            double hours = Math.round(e.getValue()[0] * 10.0) / 10.0;
            if (hours <= 0) continue;
            distribution.add(new TimeBlock(e.getKey(), hours,
                colorByLabel.getOrDefault(e.getKey(), "#451de3")));
        }
        distribution.sort(Comparator.comparingDouble(TimeBlock::hours).reversed());

        TimeOfDayPerformance bestTime = null;
        TimeOfDayPerformance worstTime = null;
        for (Map.Entry<String, int[]> e : bucketAcc.entrySet()) {
            int[] a = e.getValue();
            if (a[0] == 0) continue;
            int rate = Math.round(100f * a[1] / a[0]);
            if (bestTime == null || rate > bestTime.percent()) {
                bestTime = new TimeOfDayPerformance(e.getKey(), rate);
            }
            if (worstTime == null || rate < worstTime.percent()) {
                worstTime = new TimeOfDayPerformance(e.getKey(), rate);
            }
        }

        return new InsightSummaryResponse(window, discipline, adherence, topStreak,
            dayList, goals, distribution, bestTime, worstTime);
    }

    static String timeOfDayLabel(String startTime) {
        int hour = Integer.parseInt(startTime.split(":")[0]);
        if (hour >= 5 && hour < 12) return "Morning";
        if (hour >= 12 && hour < 17) return "Afternoon";
        if (hour >= 17 && hour < 21) return "Evening";
        return "Night";
    }

    private static boolean isAdherent(PlannedTask t, LocalDate d, Instant completedAt, ZoneId zone) {
        if (completedAt == null) return false;
        ZonedDateTime z = completedAt.atZone(zone);
        if (!z.toLocalDate().equals(d)) return false;
        int mins = z.getHour() * 60 + z.getMinute();
        int startMin = toMinutes(t.getStartTime());
        int endMin = toMinutes(t.getEndTime());
        // On-time = completed between the slot start and one hour past the slot end.
        return mins >= startMin && mins <= endMin + 60;
    }

    private Map<UUID, Map<LocalDate, PlannedTaskCompletion>> completionRowsByTask(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, Map<LocalDate, PlannedTaskCompletion>> out = new HashMap<>();
        for (PlannedTaskCompletion c : completions.findByTaskIdIn(ids)) {
            out.computeIfAbsent(c.getTaskId(), k -> new HashMap<>())
               .put(c.getCompletedDate(), c);
        }
        return out;
    }

    static int currentStreak(PlannedTask t,
                             LocalDate from,
                             Map<LocalDate, ExceptionType> exForTask,
                             Set<LocalDate> completedDates,
                             boolean countCompleted) {
        int length = 0;
        LocalDate cursor = from;
        for (int i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
            if (!PlannedTaskService.appliesOn(t, cursor, exForTask)) {
                cursor = cursor.minusDays(1);
                continue;
            }
            boolean done = completedDates.contains(cursor);
            boolean matched = countCompleted ? done : !done;
            if (cursor.equals(from) && !done && countCompleted) {
                cursor = cursor.minusDays(1);
                continue;
            }
            if (!matched) break;
            length++;
            cursor = cursor.minusDays(1);
        }
        return length;
    }

    private TomorrowSummary computeTomorrow(UUID userId, LocalDate date) {
        List<PlannedTaskResponse> tomorrowList = taskService.findForDate(userId, date);

        int unscheduled = (int) tomorrowList.stream()
            .filter(PlannedTaskResponse::needsTimeSlot)
            .filter(t -> t.startTime() == null
                && (t.segmentsForDate() == null || t.segmentsForDate().isEmpty()))
            .count();

        List<int[]> windows = new ArrayList<>();
        for (PlannedTaskResponse t : tomorrowList) {
            if (t.segmentsForDate() != null && !t.segmentsForDate().isEmpty()) {
                t.segmentsForDate().forEach(s ->
                    windows.add(new int[]{toMinutes(s.startTime()), toMinutes(s.endTime())}));
            } else if (t.startTime() != null && t.endTime() != null) {
                windows.add(new int[]{toMinutes(t.startTime()), toMinutes(t.endTime())});
            }
        }
        windows.sort(Comparator.comparingInt(a -> a[0]));
        int conflicts = 0;
        int prevEnd = Integer.MIN_VALUE;
        for (int[] w : windows) {
            if (w[0] < prevEnd) conflicts++;
            prevEnd = Math.max(prevEnd, w[1]);
        }

        return new TomorrowSummary(date, unscheduled, conflicts);
    }

    private static int toMinutes(String hhmm) {
        String[] parts = hhmm.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    private Map<UUID, Map<LocalDate, ExceptionType>> exceptionsByTaskAndDate(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, Map<LocalDate, ExceptionType>> out = new HashMap<>();
        for (PlannedTaskException e : exceptions.findByTaskIdIn(ids)) {
            out.computeIfAbsent(e.getTaskId(), k -> new HashMap<>())
               .put(e.getExceptionDate(), e.getExceptionType());
        }
        return out;
    }

    private Map<UUID, Set<LocalDate>> completionsByTaskAndDate(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        Map<UUID, PlannedTask> byId = new HashMap<>();
        for (PlannedTask t : list) byId.put(t.getId(), t);
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, Set<LocalDate>> out = new HashMap<>();
        for (PlannedTaskCompletion c : completions.findByTaskIdIn(ids)) {
            PlannedTask t = byId.get(c.getTaskId());
            if (t == null || c.getCount() < PlannedTaskService.targetFor(t)) continue;
            out.computeIfAbsent(c.getTaskId(), k -> new HashSet<>()).add(c.getCompletedDate());
        }
        return out;
    }
}
