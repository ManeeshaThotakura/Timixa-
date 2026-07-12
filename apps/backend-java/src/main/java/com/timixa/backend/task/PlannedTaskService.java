package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PatternSlotResponse;
import com.timixa.backend.task.dto.PlannedTaskExceptionResponse;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskSegmentResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class PlannedTaskService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;
    private final PlannedTaskExceptionRepository exceptions;
    private final PlannedTaskSegmentRepository segments;
    private final PlannedTaskWeekSlotRepository weekSlots;

    public PlannedTaskService(PlannedTaskRepository tasks,
                              PlannedTaskCompletionRepository completions,
                              PlannedTaskExceptionRepository exceptions,
                              PlannedTaskSegmentRepository segments,
                              PlannedTaskWeekSlotRepository weekSlots) {
        this.tasks = tasks;
        this.completions = completions;
        this.exceptions = exceptions;
        this.segments = segments;
        this.weekSlots = weekSlots;
    }

    @Transactional
    public PlannedTaskResponse create(UUID userId, PlannedTaskRequest req) {
        PlannedTask t = new PlannedTask();
        t.setUserId(userId);
        t.setTitle(req.title());
        t.setGoal(req.goal());
        if (req.color() != null) t.setColor(req.color());
        t.setCadence(req.cadence());
        if (req.needsTimeSlot() != null) t.setNeedsTimeSlot(req.needsTimeSlot());
        t.setStartTime(req.startTime());
        t.setEndTime(req.endTime());
        t.setScheduledDate(req.scheduledDate());
        t.setWeekdaysSet(req.weekdays());
        t.setMonthDaysSet(req.monthDays());
        t.setMinTimeMinutes(req.minTimeMinutes());
        t.setMaxTimeMinutes(req.maxTimeMinutes());
        t.setMinCount(req.minCount());
        t.setMaxCount(req.maxCount());
        if (req.notifyAtStart() != null) t.setNotifyAtStart(req.notifyAtStart());
        if (req.notifyAtEnd() != null) t.setNotifyAtEnd(req.notifyAtEnd());
        validate(t);
        PlannedTask saved = tasks.save(t);
        return PlannedTaskResponse.from(saved, List.of(), false);
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findAll(UUID userId) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, List<PlannedTaskExceptionResponse>> exMap = exceptionsByTask(all);
        Map<UUID, Integer> countToday = countsForDate(all, LocalDate.now());
        return all.stream()
            .map(t -> {
                int currentCount = countToday.getOrDefault(t.getId(), 0);
                boolean completed = currentCount >= targetFor(t);
                return PlannedTaskResponse.from(
                    t,
                    exMap.getOrDefault(t.getId(), List.of()),
                    List.of(),
                    completed,
                    currentCount);
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findForDate(UUID userId, LocalDate date) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, Map<LocalDate, ExceptionType>> exByTaskAndDate = exceptionsByTaskAndDate(all);
        List<PlannedTask> filtered = all.stream()
            .filter(t -> appliesOn(t, date, exByTaskAndDate.getOrDefault(t.getId(), Map.of())))
            .toList();
        Map<UUID, List<PlannedTaskExceptionResponse>> exMap = exceptionsByTask(filtered);
        Map<UUID, List<PlannedTaskSegmentResponse>> segMap = segmentsForDate(filtered, date);
        Map<UUID, List<PatternSlotResponse>> patternMap = patternForWeekday(filtered, date.getDayOfWeek());
        Map<UUID, Integer> countByTask = countsForDate(filtered, date);
        return filtered.stream()
            .map(t -> {
                int currentCount = countByTask.getOrDefault(t.getId(), 0);
                boolean completed = currentCount >= targetFor(t);
                return PlannedTaskResponse.from(
                    t,
                    exMap.getOrDefault(t.getId(), List.of()),
                    segMap.getOrDefault(t.getId(), List.of()),
                    patternMap.getOrDefault(t.getId(), List.of()),
                    completed,
                    currentCount);
            })
            .toList();
    }

    private Map<UUID, List<PatternSlotResponse>> patternForWeekday(List<PlannedTask> list, java.time.DayOfWeek dow) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, List<PatternSlotResponse>> out = new HashMap<>();
        for (PlannedTaskWeekSlot s : weekSlots.findByTaskIdInAndWeekday(ids, dow)) {
            out.computeIfAbsent(s.getTaskId(), k -> new ArrayList<>())
               .add(PatternSlotResponse.from(s));
        }
        out.values().forEach(l -> l.sort(java.util.Comparator.comparing(PatternSlotResponse::startTime)));
        return out;
    }

    public static int targetFor(PlannedTask t) {
        if (t.getMinTimeMinutes() != null && t.getMinTimeMinutes() > 0) {
            return t.getMinTimeMinutes();
        }
        Integer slotMinutes = slotDurationMinutes(t);
        if (slotMinutes != null && slotMinutes > 0) return slotMinutes;
        return Math.max(1, t.getMinCount() == null ? 1 : t.getMinCount());
    }

    private static Integer slotDurationMinutes(PlannedTask t) {
        if (t.getStartTime() == null || t.getEndTime() == null) return null;
        try {
            String[] s = t.getStartTime().split(":");
            String[] e = t.getEndTime().split(":");
            int start = Integer.parseInt(s[0]) * 60 + Integer.parseInt(s[1]);
            int end   = Integer.parseInt(e[0]) * 60 + Integer.parseInt(e[1]);
            int diff = end - start;
            return diff > 0 ? diff : null;
        } catch (Exception ex) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public PlannedTaskResponse findOne(UUID userId, UUID taskId) {
        return findOneForDate(userId, taskId, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public PlannedTaskResponse findOneForDate(UUID userId, UUID taskId, LocalDate date) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        List<PlannedTaskExceptionResponse> ex = exceptions.findByTaskIdIn(List.of(t.getId())).stream()
            .map(PlannedTaskExceptionResponse::from).toList();
        List<PlannedTaskSegmentResponse> seg = segments.findByTaskIdAndSegmentDate(t.getId(), date).stream()
            .map(PlannedTaskSegmentResponse::from).toList();
        List<PatternSlotResponse> pattern = weekSlots
            .findByTaskIdAndWeekday(t.getId(), date.getDayOfWeek()).stream()
            .map(PatternSlotResponse::from)
            .sorted(java.util.Comparator.comparing(PatternSlotResponse::startTime))
            .toList();
        int currentCount = completions.findByTaskIdAndCompletedDate(t.getId(), date)
            .map(PlannedTaskCompletion::getCount).orElse(0);
        boolean completed = currentCount >= targetFor(t);
        return PlannedTaskResponse.from(t, ex, seg, pattern, completed, currentCount);
    }

    @Transactional
    public PlannedTaskResponse update(UUID userId, UUID taskId, PlannedTaskUpdateRequest req) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        if (req.title() != null) t.setTitle(req.title());
        if (req.goal() != null) t.setGoal(req.goal());
        if (req.color() != null) t.setColor(req.color());
        if (req.cadence() != null && req.cadence() != t.getCadence()) {
            t.setCadence(req.cadence());
            // Day-selectors of the old cadence would fail validation under the new one.
            switch (req.cadence()) {
                case DAILY -> { t.setScheduledDate(null); t.setWeekdaysSet(null); t.setMonthDaysSet(null); }
                case WEEKLY -> { t.setScheduledDate(null); t.setMonthDaysSet(null); }
                case MONTHLY -> { t.setScheduledDate(null); t.setWeekdaysSet(null); }
                case ONCE -> { t.setWeekdaysSet(null); t.setMonthDaysSet(null); }
            }
        }
        if (req.needsTimeSlot() != null) {
            t.setNeedsTimeSlot(req.needsTimeSlot());
            if (!req.needsTimeSlot()) { t.setStartTime(null); t.setEndTime(null); }
        }
        if (req.startTime() != null) t.setStartTime(req.startTime());
        if (req.endTime() != null) t.setEndTime(req.endTime());
        if (req.scheduledDate() != null) t.setScheduledDate(req.scheduledDate());
        if (req.weekdays() != null) t.setWeekdaysSet(req.weekdays());
        if (req.monthDays() != null) t.setMonthDaysSet(req.monthDays());
        // 0 = explicit "clear this constraint" (PATCH JSON can't distinguish null from absent).
        if (req.minTimeMinutes() != null) t.setMinTimeMinutes(req.minTimeMinutes() == 0 ? null : req.minTimeMinutes());
        if (req.maxTimeMinutes() != null) t.setMaxTimeMinutes(req.maxTimeMinutes() == 0 ? null : req.maxTimeMinutes());
        if (req.minCount() != null) t.setMinCount(req.minCount() == 0 ? null : req.minCount());
        if (req.maxCount() != null) t.setMaxCount(req.maxCount() == 0 ? null : req.maxCount());
        if (req.notifyAtStart() != null) t.setNotifyAtStart(req.notifyAtStart());
        if (req.notifyAtEnd() != null) t.setNotifyAtEnd(req.notifyAtEnd());
        validate(t);
        PlannedTask saved = tasks.save(t);
        return findOne(userId, saved.getId());
    }

    @Transactional
    public PlannedTaskResponse complete(UUID userId, UUID taskId, LocalDate date) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        int target = targetFor(t);
        PlannedTaskCompletion c = completions.findByTaskIdAndCompletedDate(t.getId(), date)
            .orElse(null);
        if (c != null && c.getCount() >= target) throw new TaskAlreadyCompleteException();
        if (c == null) {
            c = new PlannedTaskCompletion(t.getId(), date, target, Instant.now());
        } else {
            c.setCount(target);
            c.setCompletedAt(Instant.now());
        }
        completions.save(c);
        return findOneForDate(userId, t.getId(), date);
    }

    @Transactional
    public PlannedTaskResponse increment(UUID userId, UUID taskId, LocalDate date, int delta) {
        if (delta < 1) delta = 1;
        PlannedTask t = requireOwnedTask(userId, taskId);
        // Atomic in-database increment — concurrent taps must not lose updates.
        int updated = completions.incrementCount(t.getId(), date, delta, Instant.now());
        if (updated == 0) {
            try {
                completions.save(new PlannedTaskCompletion(t.getId(), date, delta, Instant.now()));
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // Lost the insert race to a concurrent request — fall back to increment.
                completions.incrementCount(t.getId(), date, delta, Instant.now());
            }
        }
        return findOneForDate(userId, t.getId(), date);
    }

    @Transactional
    public void uncomplete(UUID userId, UUID taskId, LocalDate date) {
        requireOwnedTask(userId, taskId);
        completions.deleteByTaskIdAndCompletedDate(taskId, date);
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        completions.deleteByTaskId(taskId);
        exceptions.deleteByTaskId(taskId);
        segments.deleteByTaskId(taskId);
        weekSlots.deleteByTaskId(taskId);
        tasks.delete(t);
    }

    PlannedTask requireOwnedTask(UUID userId, UUID taskId) {
        PlannedTask t = tasks.findById(taskId).orElseThrow(TaskNotFoundException::new);
        if (!t.getUserId().equals(userId)) throw new TaskNotFoundException();
        return t;
    }

    public static boolean appliesOn(PlannedTask t,
                                    LocalDate date,
                                    Map<LocalDate, ExceptionType> exForTask) {
        ExceptionType ex = exForTask == null ? null : exForTask.get(date);
        return switch (t.getCadence()) {
            case ONCE -> date.equals(t.getScheduledDate());
            case DAILY -> ex != ExceptionType.SKIP;
            case WEEKLY -> {
                boolean covered = t.getWeekdaysSet().contains(date.getDayOfWeek());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
            case MONTHLY -> {
                boolean covered = t.getMonthDaysSet().contains(date.getDayOfMonth());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
        };
    }

    public static boolean appliesOn(PlannedTask t, LocalDate date) {
        return appliesOn(t, date, Map.of());
    }

    private Map<UUID, Integer> countsForDate(List<PlannedTask> list, LocalDate date) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, Integer> out = new HashMap<>();
        for (PlannedTaskCompletion c : completions.findByTaskIdInAndCompletedDate(ids, date)) {
            out.put(c.getTaskId(), c.getCount());
        }
        return out;
    }

    private Map<UUID, List<PlannedTaskExceptionResponse>> exceptionsByTask(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, List<PlannedTaskExceptionResponse>> out = new HashMap<>();
        for (PlannedTaskException e : exceptions.findByTaskIdIn(ids)) {
            out.computeIfAbsent(e.getTaskId(), k -> new ArrayList<>())
               .add(PlannedTaskExceptionResponse.from(e));
        }
        return out;
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

    private Map<UUID, List<PlannedTaskSegmentResponse>> segmentsForDate(List<PlannedTask> list, LocalDate date) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, List<PlannedTaskSegmentResponse>> out = new HashMap<>();
        for (PlannedTaskSegment s : segments.findByTaskIdInAndSegmentDate(ids, date)) {
            out.computeIfAbsent(s.getTaskId(), k -> new ArrayList<>())
               .add(PlannedTaskSegmentResponse.from(s));
        }
        return out;
    }

    private void validate(PlannedTask t) {
        Cadence c = t.getCadence();
        if (c == null) throw new IllegalArgumentException("cadence is required");

        switch (c) {
            case ONCE -> {
                if (t.getScheduledDate() == null)
                    throw new IllegalArgumentException("ONCE tasks require scheduledDate");
                if (!t.getWeekdaysSet().isEmpty() || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("ONCE tasks must not set weekdays or monthDays");
            }
            case DAILY -> {
                if (t.getScheduledDate() != null || !t.getWeekdaysSet().isEmpty() || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("DAILY tasks must not set scheduledDate, weekdays, or monthDays");
            }
            case WEEKLY -> {
                // Empty weekdays = "floating" weekly task: applies to no day until the
                // user schedules it (ADD exception / segment via the schedule FAB).
                if (t.getScheduledDate() != null || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("WEEKLY tasks must not set scheduledDate or monthDays");
            }
            case MONTHLY -> {
                // Empty monthDays = floating monthly task (see WEEKLY above).
                if (t.getScheduledDate() != null || !t.getWeekdaysSet().isEmpty())
                    throw new IllegalArgumentException("MONTHLY tasks must not set scheduledDate or weekdays");
            }
        }

        if (!t.isNeedsTimeSlot() && (t.getStartTime() != null || t.getEndTime() != null))
            throw new IllegalArgumentException("needsTimeSlot=false tasks must not have times");

        if (t.getStartTime() != null) {
            if (t.getEndTime() == null)
                throw new IllegalArgumentException("endTime is required when startTime is set");
            if (t.getEndTime().compareTo(t.getStartTime()) <= 0)
                throw new IllegalArgumentException("endTime must be after startTime");
        }

        if (t.getMinTimeMinutes() != null && t.getMinTimeMinutes() <= 0)
            throw new IllegalArgumentException("minTimeMinutes must be > 0");
        if (t.getMaxTimeMinutes() != null && t.getMaxTimeMinutes() <= 0)
            throw new IllegalArgumentException("maxTimeMinutes must be > 0");
        if (t.getMinCount() != null && t.getMinCount() <= 0)
            throw new IllegalArgumentException("minCount must be > 0");
        if (t.getMaxCount() != null && t.getMaxCount() <= 0)
            throw new IllegalArgumentException("maxCount must be > 0");
        if (t.getMinTimeMinutes() != null && t.getMaxTimeMinutes() != null
                && t.getMaxTimeMinutes() < t.getMinTimeMinutes())
            throw new IllegalArgumentException("maxTimeMinutes must be >= minTimeMinutes");
        if (t.getMinCount() != null && t.getMaxCount() != null
                && t.getMaxCount() < t.getMinCount())
            throw new IllegalArgumentException("maxCount must be >= minCount");
    }
}
