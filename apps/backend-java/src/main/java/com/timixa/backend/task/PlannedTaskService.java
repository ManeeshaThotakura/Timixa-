package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class PlannedTaskService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;

    public PlannedTaskService(PlannedTaskRepository tasks,
                              PlannedTaskCompletionRepository completions) {
        this.tasks = tasks;
        this.completions = completions;
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
        validate(t);
        PlannedTask saved = tasks.save(t);
        return PlannedTaskResponse.from(saved, false);
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findAll(UUID userId) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Set<UUID> completedToday = completedIdsForToday(all);
        return all.stream()
            .map(t -> PlannedTaskResponse.from(t, completedToday.contains(t.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findForDate(UUID userId, LocalDate date) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        List<PlannedTask> filtered = all.stream().filter(t -> appliesOn(t, date)).toList();
        Set<UUID> completedToday = completedIdsForToday(filtered);
        return filtered.stream()
            .map(t -> PlannedTaskResponse.from(t, completedToday.contains(t.getId())))
            .toList();
    }

    @Transactional
    public PlannedTaskResponse update(UUID userId, UUID taskId, PlannedTaskUpdateRequest req) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        if (req.title() != null) t.setTitle(req.title());
        if (req.goal() != null) t.setGoal(req.goal());
        if (req.color() != null) t.setColor(req.color());
        if (req.cadence() != null) t.setCadence(req.cadence());
        if (req.needsTimeSlot() != null) t.setNeedsTimeSlot(req.needsTimeSlot());
        if (req.startTime() != null) t.setStartTime(req.startTime());
        if (req.endTime() != null) t.setEndTime(req.endTime());
        if (req.scheduledDate() != null) t.setScheduledDate(req.scheduledDate());
        if (req.weekdays() != null) t.setWeekdaysSet(req.weekdays());
        if (req.monthDays() != null) t.setMonthDaysSet(req.monthDays());
        validate(t);
        PlannedTask saved = tasks.save(t);
        boolean completed = !completions
            .findCompletedTaskIds(List.of(saved.getId()), LocalDate.now()).isEmpty();
        return PlannedTaskResponse.from(saved, completed);
    }

    @Transactional
    public PlannedTaskResponse complete(UUID userId, UUID taskId, LocalDate date) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        PlannedTaskCompletionId pk = new PlannedTaskCompletionId(t.getId(), date);
        if (completions.existsById(pk)) throw new TaskAlreadyCompleteException();
        completions.save(new PlannedTaskCompletion(t.getId(), date, Instant.now()));
        boolean completedToday = date.equals(LocalDate.now())
            || !completions.findCompletedTaskIds(List.of(t.getId()), LocalDate.now()).isEmpty();
        return PlannedTaskResponse.from(t, completedToday);
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
        tasks.delete(t);
    }

    PlannedTask requireOwnedTask(UUID userId, UUID taskId) {
        PlannedTask t = tasks.findById(taskId).orElseThrow(TaskNotFoundException::new);
        if (!t.getUserId().equals(userId)) throw new TaskNotFoundException();
        return t;
    }

    static boolean appliesOn(PlannedTask t, LocalDate date) {
        return switch (t.getCadence()) {
            case ONCE -> date.equals(t.getScheduledDate());
            case DAILY -> true;
            case WEEKLY -> t.getWeekdaysSet().contains(date.getDayOfWeek());
            case MONTHLY -> t.getMonthDaysSet().contains(date.getDayOfMonth());
        };
    }

    private Set<UUID> completedIdsForToday(List<PlannedTask> list) {
        if (list.isEmpty()) return Set.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        return new HashSet<>(completions.findCompletedTaskIds(ids, LocalDate.now()));
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
                if (t.getWeekdaysSet().isEmpty())
                    throw new IllegalArgumentException("WEEKLY tasks require non-empty weekdays");
                if (t.getScheduledDate() != null || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("WEEKLY tasks must not set scheduledDate or monthDays");
            }
            case MONTHLY -> {
                if (t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("MONTHLY tasks require non-empty monthDays");
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
    }
}
